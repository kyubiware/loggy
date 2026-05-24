import { debugLog } from '../utils/debug-logger'
import { LOGGY_MESSAGE_NAMESPACE, type CaptureMessage, type LoggyMessage } from '../types/messages'
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
  activeTabId,
  setActiveTabId,
  getOrCreateTabState,
  getStorageKeyForTab,
  setMode,
  persistTabStates,
  updateIconForTab,
  restoreTabStatesFromStorage,
  restoreLogCountsFromStorage,
  refreshActiveTabId,
} from './tab-state'
import { evaluateConsent } from './consent'
import { getFailedBufferStorageKeyForTab, lastExportFingerprintByTab } from './server-sync'
import { AUTO_SYNC_ALARM_NAME, pollAllActiveTabs } from './polling'
import {
  handleCaptureMessage,
  handleControlMessage,
  isCaptureMessage,
  isControlMessage,
} from './messages'

async function initialize(): Promise<void> {
  debugLog('lifecycle', 'background', 'Service worker initializing')
  setCaptureCallback((tabId: number, message: CaptureMessage) => {
    void handleCaptureMessage(tabId, message, 'debugger')
  })

  await restoreTabStatesFromStorage()
  await restoreLogCountsFromStorage()
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

  await chrome.storage.local.get(LOGGY_ALWAYS_LOG_HOSTS_KEY)

  const alwaysLogHosts = await getAlwaysLogHosts()
  await syncAllAlwaysLogScripts(alwaysLogHosts.map((h) => h.host))

  // Register periodic alarm for background auto-sync polling.
  // chrome.alarms enforces a minimum period of 30s in production MV3.
  try {
    await chrome.alarms.clear(AUTO_SYNC_ALARM_NAME)
    await chrome.alarms.create(AUTO_SYNC_ALARM_NAME, { periodInMinutes: 0.5 })
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

chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
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

chrome.tabs.onRemoved.addListener((tabId) => {
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
  if (activeTabId === tabId) {
    setActiveTabId(null)
  }

  void (async () => {
    await persistTabStates()
    await chrome.storage.session.remove(getStorageKeyForTab(tabId))
    await chrome.storage.session.remove(getFailedBufferStorageKeyForTab(tabId))
  })()
})

chrome.tabs.onActivated.addListener((activeInfo) => {
  setActiveTabId(activeInfo.tabId)
  updateIconForTab(activeInfo.tabId)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Only react to URL changes (SPA navigation or full page navigation)
  if (!changeInfo.url) {
    return
  }

  const url = changeInfo.url
  void (async () => {
    try {
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
            await chrome.tabs.sendMessage(tabId, {
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
            await chrome.tabs.sendMessage(tabId, {
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

chrome.runtime.onInstalled.addListener(() => {
  void initialize()
})

chrome.runtime.onStartup.addListener(() => {
  void initialize()
})

self.addEventListener('activate', () => {
  void initialize()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== AUTO_SYNC_ALARM_NAME) return
  void pollAllActiveTabs()
})

void initialize()
