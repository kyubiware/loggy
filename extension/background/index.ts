import { clearDebugEntries, debugLog } from '../utils/debug-logger'
import { LOGGY_MESSAGE_NAMESPACE, type CaptureMessage, type LoggyMessage } from '../types/messages'
import { browser } from '../browser-apis/index'
import type { BrowserPort } from '../browser-apis/index'
import {
  attachToTab,
  detachFromTab,
  isAttached as isDebuggerAttached,
  setCaptureCallback,
} from '../capture/debugger-capture'
import { injectIntoTab, syncAllAlwaysLogScripts } from './content-scripts'
import { LOGGY_ALWAYS_LOG_HOSTS_KEY, getAlwaysLogHosts } from './storage'
import {
  tabStates,
  previousModeByTab,
  debuggerResumeTimersByTab,
  explicitlyStoppedByTab,
  activeTabId,
  setActiveTabId,
  getMode,
  getOrCreateTabState,
  getStorageKeyForTab,
  setMode,
  setTabState,
  persistTabStates,
  updateIconForTab,
  restoreTabStatesFromStorage,
  restoreLogCountsFromStorage,
  restoreExplicitlyStoppedTabsFromStorage,
  refreshActiveTabId,
  pendingNavigationByTab,
} from './tab-state'
import { evaluateConsent } from './consent'
import {
  getFailedBufferStorageKeyForTab,
  getPreserveLogs,
  lastExportFingerprintByTab,
} from './server-sync'
import { AUTO_SYNC_ALARM_NAME, pollAllActiveTabs, setPolledCount } from './polling'
import {
  handleCaptureMessage,
  handleControlMessage,
  isCaptureMessage,
  isControlMessage,
} from './messages'
import { handlePanelClosed } from './messages/tab-lifecycle'

/**
 * Re-attaches the Chrome debugger after it was auto-detached by a
 * navigation or page refresh. Chrome's debugger detaches on every new
 * document load (browser.debugger.onDetach fires); without re-attachment,
 * capture silently dies after the first navigation.
 *
 * Guards:
 * - Skips tabs the user explicitly stopped logging on.
 * - Skips non-debugger modes (content-script, devtools, inactive).
 * - Skips when the debugger is still attached (SPA navigation).
 * - Skips tabs without consent (navigating to a non-consented host).
 *
 * On re-attach failure (e.g. another debugger is attached), falls back
 * to content-script mode so capture continues.
 */
async function maybeReattachDebugger(tabId: number): Promise<void> {
  if (explicitlyStoppedByTab.has(tabId)) {
    return
  }

  const current = getOrCreateTabState(tabId)
  if (current.mode !== 'debugger') {
    return
  }

  if (isDebuggerAttached(tabId)) {
    return
  }

  let url = ''
  try {
    const tab = await browser.tabs.get(tabId)
    url = tab.url ?? ''
  } catch {
    debugLog('capture', 'background', `Tab loading: cannot get tab for debugger re-attach`, { tabId })
    return
  }

  const consent = await evaluateConsent(tabId, url)
  if (!consent.hasConsent) {
    debugLog('capture', 'background', `Tab loading: skipping debugger re-attach (no consent)`, { tabId })
    return
  }

  debugLog('capture', 'background', `Tab loading: re-attaching debugger after navigation`, { tabId })
  attachToTab(tabId, (error) => {
    if (error) {
      console.error('[Loggy] Failed to re-attach debugger after navigation:', error.message)
      void (async () => {
        await setMode(tabId, 'content-script')
        updateIconForTab(tabId)
        try {
          await injectIntoTab(tabId)
        } catch {
          // Injection may fail on some pages (chrome://, etc.)
        }
      })()
    }
  })
}

async function initialize(): Promise<void> {
  debugLog('lifecycle', 'background', 'Service worker initializing')
  setCaptureCallback((tabId: number, message: CaptureMessage) => {
    void handleCaptureMessage(tabId, message, 'debugger')
  })

  await restoreTabStatesFromStorage()
  await restoreLogCountsFromStorage()
  await restoreExplicitlyStoppedTabsFromStorage()
  await refreshActiveTabId()

  for (const [tabId, state] of tabStates.entries()) {
    if (state.mode === 'content-script') {
      try {
        await injectIntoTab(tabId)
      } catch (error) {
        console.error(`[Loggy] Failed to re-inject into tab ${tabId} on init:`, error)
      }
    }
  }

  if (activeTabId !== null) {
    updateIconForTab(activeTabId)
  }

  await browser.storage.local.get(LOGGY_ALWAYS_LOG_HOSTS_KEY)

  const alwaysLogHosts = await getAlwaysLogHosts()
  await syncAllAlwaysLogScripts(alwaysLogHosts.map((h) => h.host))

  // Register periodic alarm for background auto-sync polling.
  // browser.alarms enforces a minimum period of 30s in production MV3.
  try {
    await browser.alarms.clear(AUTO_SYNC_ALARM_NAME)
    await browser.alarms.create(AUTO_SYNC_ALARM_NAME, { periodInMinutes: 0.5 })
    debugLog('lifecycle', 'background', 'Auto-sync alarm registered (30s period)')
  } catch (error) {
    debugLog('lifecycle', 'background', `Failed to register auto-sync alarm: ${String(error)}`)
  }

  // Trigger an initial poll for any tabs that already have data.
  // Fire-and-forget: errors are logged inside pollAllActiveTabs.
  void pollAllActiveTabs().catch(() => {
    // Intentionally swallowed — pollAllActiveTabs logs errors internally
  })
}

/**
 * Listen for long-lived port connections from the DevTools panel.
 *
 * The panel opens a `loggy-panel` port on mount. When the panel page is
 * destroyed (DevTools panel closed), the port auto-disconnects. This is
 * the only reliable way to detect panel close on Firefox, where React
 * useEffect cleanup may not fire.
 *
 * To avoid double-firing on Chrome (where both the port disconnect AND
 * the `panel-closed` message fire), only call handlePanelClosed when the
 * mode is still `devtools` — the message handler transitions away from
 * `devtools` first.
 */
browser.runtime.onConnect.addListener((port: BrowserPort) => {
  if (port.name !== 'loggy-panel') return

  let panelTabId: number | undefined

  port.onMessage.addListener((msg: unknown) => {
    if (msg && typeof (msg as { tabId?: unknown }).tabId === 'number') {
      panelTabId = (msg as { tabId: number }).tabId
    }
  })

  port.onDisconnect.addListener(() => {
    if (panelTabId !== undefined && getMode(panelTabId) === 'devtools') {
      // Cleanup didn't fire (Firefox) — handle the panel close now
      void handlePanelClosed(panelTabId)
    }
  })
})

browser.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
  const message = rawMessage as LoggyMessage
  const msgType =
    typeof message === 'object' && message !== null && 'type' in message
      ? (message as { type?: unknown }).type
      : 'unknown'
  console.log('[Loggy:bg] onMessage received, type:', msgType, 'sender.tab?.id:', sender.tab?.id)
  debugLog('message', 'background', `Received message type: ${String(msgType)}`, {
    tabId: sender.tab?.id,
  })

  void (async () => {
    try {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        (message as { type?: unknown }).type === LOGGY_MESSAGE_NAMESPACE &&
        isCaptureMessage(message)
      ) {
        const tabId = sender.tab?.id
        if (typeof tabId === 'number') {
          await handleCaptureMessage(tabId, message, 'content-script')
          sendResponse({ ok: true })
          return
        }
      }

      if (isCaptureMessage(message)) {
        const tabId = sender.tab?.id
        if (typeof tabId === 'number') {
          await handleCaptureMessage(tabId, message, 'content-script')
          sendResponse({ ok: true })
          return
        }

        sendResponse({ ok: false })
        return
      }

      if (isControlMessage(message)) {
        const response = await handleControlMessage(message, sender)
        sendResponse(response)
        return
      }

      sendResponse({ ok: false })
    } catch (error) {
      console.error('[Loggy] Background message handler failed:', error)
      sendResponse({ ok: false })
    }
  })()

  return true
})

browser.tabs.onRemoved.addListener((tabId) => {
  const pendingResume = debuggerResumeTimersByTab.get(tabId)
  if (pendingResume) {
    clearTimeout(pendingResume)
    debuggerResumeTimersByTab.delete(tabId)
  }

  if (isDebuggerAttached(tabId)) {
    detachFromTab(tabId)
  }

  previousModeByTab.delete(tabId)
  tabStates.delete(tabId)
  lastExportFingerprintByTab.delete(tabId)
  pendingNavigationByTab.delete(tabId)
  const wasExplicitlyStopped = explicitlyStoppedByTab.delete(tabId)
  if (activeTabId === tabId) {
    setActiveTabId(null)
  }

  void (async () => {
    await persistTabStates()
    if (wasExplicitlyStopped) {
      const { persistExplicitlyStoppedTabs } = await import('./tab-state')
      await persistExplicitlyStoppedTabs()
    }
    await browser.storage.session.remove(getStorageKeyForTab(tabId))
    await browser.storage.session.remove(getFailedBufferStorageKeyForTab(tabId))
  })()
})

browser.tabs.onActivated.addListener((activeInfo) => {
  setActiveTabId(activeInfo.tabId)
  updateIconForTab(activeInfo.tabId)
})

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Mark navigation start when Chrome reports a URL change. Consumed by the
  // loading handler below. This fires BEFORE status:'loading' for navigations
  // and NEVER fires for refreshes — making it a reliable nav/refresh signal
  // even after service worker restarts (Chrome keeps the SW alive between
  // the url and loading events, which are milliseconds apart).
  if (changeInfo.url) {
    pendingNavigationByTab.add(tabId)
  }

  // Navigation should ALWAYS preserve logs; refresh is controlled by preserveLogs.
  if (changeInfo.status === 'loading') {
    void (async () => {
      try {
        // Navigation = a URL change was seen for this tab. Refresh = no URL change.
        const isNavigation = pendingNavigationByTab.delete(tabId)

        // Reset poll delta counter on both nav and refresh — MAIN-world
        // arrays reset on new document load.
        await setPolledCount(tabId, 0)
        lastExportFingerprintByTab.delete(tabId)

        if (isNavigation) {
          debugLog('capture', 'background', `Navigation: preserving entries`, { tabId })
        } else {
          // Refresh — clear only if preserveLogs is disabled.
          const preserveLogs = await getPreserveLogs()
          if (!preserveLogs) {
            debugLog('capture', 'background', `Refresh: clearing stored entries (preserveLogs=false)`, { tabId })
            await browser.storage.session.remove(getStorageKeyForTab(tabId))
            const current = getOrCreateTabState(tabId)
            await setTabState({ ...current, logCount: 0 })
            clearDebugEntries()
          } else {
            debugLog('capture', 'background', `Refresh: preserving entries (preserveLogs=true)`, { tabId })
          }
        }

        // Re-attach the debugger if it was auto-detached by navigation or
        // refresh. Chrome detaches on every new document load; without
        // re-attachment, capture silently dies. No-op for content-script
        // and devtools modes.
        await maybeReattachDebugger(tabId)
      } catch (error) {
        debugLog('capture', 'background', `Tab loading: handler failed`, { tabId, error: String(error) })
      }
    })()
  }

  // Clean up the pending-navigation flag when the page finishes loading.
  if (changeInfo.status === 'complete') {
    pendingNavigationByTab.delete(tabId)
  }

  // Only react to URL changes (SPA navigation or full page navigation)
  if (!changeInfo.url) {
    return
  }

  const url = changeInfo.url
  void (async () => {
    try {
      // Skip auto-reactivation if the user explicitly stopped logging for this tab
      if (explicitlyStoppedByTab.has(tabId)) {
        debugLog('capture', 'background', `Tab navigation: skipping re-activation (explicitly stopped)`, { tabId })
        return
      }

      const consent = await evaluateConsent(tabId, url)

      if (consent.hasConsent) {
        // Host changed to a consented host — start capture if not already active,
        // or re-inject content scripts after navigation (content scripts are lost on page reload)
        const current = getOrCreateTabState(tabId)
        const needsInjection =
          current.mode === 'inactive' || current.mode === 'content-script'
        if (needsInjection && current.mode !== 'devtools' && current.mode !== 'debugger') {
          const captureMode =
            consent.captureMode === 'debugger' ? 'debugger' : 'content-script'
          await setMode(tabId, captureMode)
          updateIconForTab(tabId)

          try {
            await injectIntoTab(tabId)
          } catch (error) {
            console.error('[Loggy] Failed to inject content scripts on navigation:', error)
          }

          if (captureMode === 'debugger') {
            attachToTab(tabId, (error) => {
              if (error) {
                console.error('[Loggy] Failed to attach debugger for SPA nav:', error.message)
                void setMode(tabId, 'content-script')
              }
            })
          }

          try {
            await browser.tabs.sendMessage(tabId, {
              type: 'consent-changed',
              hasConsent: true,
              captureMode,
            })
          } catch {
            // Content script may not be loaded
          }
        }
      } else {
        // Host changed to a non-consented host — stop capture if active
        const current = getOrCreateTabState(tabId)
        if (current.mode !== 'inactive' && current.mode !== 'devtools') {
          if (current.mode === 'debugger' && isDebuggerAttached(tabId)) {
            detachFromTab(tabId)
          }
          await setMode(tabId, 'inactive')
          updateIconForTab(tabId)

          try {
            await browser.tabs.sendMessage(tabId, {
              type: 'consent-changed',
              hasConsent: false,
              captureMode: 'none',
            })
          } catch {
            // Content script may not be loaded
          }
        }
      }
    } catch (error) {
      console.error('[Loggy] SPA navigation consent re-evaluation failed:', error)
    }
  })()
})

browser.runtime.onInstalled.addListener(() => {
  void initialize()
})

browser.runtime.onStartup.addListener(() => {
  void initialize()
})

self.addEventListener('activate', () => {
  void initialize()
})

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== AUTO_SYNC_ALARM_NAME) return
  void pollAllActiveTabs()
})

void initialize()
