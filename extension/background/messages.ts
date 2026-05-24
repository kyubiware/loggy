import {
  tabStates,
  previousModeByTab,
  debuggerResumeTimersByTab,
  activeTabId,
  getStorageKeyForTab,
  getOrCreateTabState,
  setTabState,
  setMode,
  getMode,
  getActiveTabStatus,
  updateIconForTab,
} from './tab-state'
import { evaluateConsent } from './consent'
import { readStoredEntries, toConsoleMessage, toHAREntry, storeCapturedData } from './entry-storage'
import type { StoredCapturedEntry } from './entry-storage'
import {
  getAutoServerSync,
  getServerUrl,
  getTabUrl,
  pushToServer,
  probeServerFromBackground,
  exportTabToServer,
  clearFailedExportBuffer,
  buildTabMarkdown,
} from './server-sync'
import { pollAndSyncTab } from './polling'
import {
  attachToTab,
  detachFromTab,
  isAttached as isDebuggerAttached,
} from '../capture/debugger-capture'
import {
  injectIntoTab,
  registerAlwaysLogScriptsForHost,
  unregisterAlwaysLogScriptsForHost,
} from './content-scripts'
import { buildExportMarkdown } from '../shared/export'
import { getFilteredPanelData } from '../utils/filtered-data'
import { estimateTokenCount } from '../utils/token-estimate'
import { debugLog } from '../utils/debug-logger'
import {
  LOGGY_MESSAGE_NAMESPACE,
  type AddAlwaysLogMessage,
  type AlwaysLogHost,
  type AlwaysLogHostsResponse,
  type CachePreviewMessage,
  type CachePreviewResponse,
  type ClearTabDataMessage,
  type CapturedConsoleEntry,
  type CapturedNetworkEntry,
  type CaptureControlMessage,
  type CaptureMessage,
  type CaptureMode,
  type ConsentResponseMessage,
  type ConsentState,
  type GetCachedPreviewMessage,
  type GetAlwaysLogHostsMessage,
  type RequestConsentMessage,
  type StartLoggingMessage,
  type StopLoggingMessage,
  type StatusResponse,
  type TabExportDataResponse,
  type TabCaptureState,
  type CachedPreviewResponse,
  type ProbeServerMessage,
  type ProbeServerResponse,
  type PushToServerMessage,
  type PushToServerResponse,
  type RemoveAlwaysLogMessage,
} from '../types/messages'
import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'
import {
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  createDefaultSettings,
  createInitialState,
  mergePersistedSettings,
} from '../types/state'
import {
  LOGGY_ALWAYS_LOG_HOSTS_KEY,
  addAlwaysLogHost,
  getAlwaysLogHosts,
  removeAlwaysLogHost,
} from './storage'

const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000
const previewCache = new Map<string, { markdown: string; createdAt: number }>()

export async function handleCaptureMessage(
  tabId: number,
  message: CaptureMessage,
  source: 'content-script' | 'debugger'
): Promise<void> {
  const current = getOrCreateTabState(tabId)
  debugLog('capture', 'background', `handleCaptureMessage: mode=${current.mode} source=${source}`, { tabId })

  if (current.mode === 'debugger' && source !== 'debugger') {
    return
  }

  // Always store captured data so it's available for export when the
  // panel closes. Skip the auto-sync trigger if the panel is open —
  // the panel's React effects handle auto-sync while devtools mode is active.
  const panelIsOpen = current.mode === 'devtools'

  const logCount = await storeCapturedData(tabId, message)

  const nextMode: CaptureMode =
    source === 'debugger'
      ? 'debugger'
      : current.mode === 'inactive'
        ? 'content-script'
        : current.mode
  debugLog('capture', 'background', `Captured ${message.source} entry, total: ${logCount}`, { tabId, source, mode: nextMode })

  const next: TabCaptureState = {
    ...current,
    mode: nextMode,
    connected: true,
    logCount,
  }

  await setTabState(next)
  // Skip auto-sync trigger while DevTools panel is open — the panel's
  // React effects handle auto-sync. Data is still stored so it's available
  // for export when the panel closes.
  if (panelIsOpen) {
    debugLog('capture', 'background', `Data stored (panel open, skipping background auto-sync)`, { tabId, logCount })
    return
  }
  const autoSync = await getAutoServerSync()
  if (autoSync) {
    debugLog('capture', 'background', `Auto-sync ENABLED, calling exportTabToServer`, { tabId, autoSync })
    await exportTabToServer(tabId)
  } else {
    debugLog('capture', 'background', `Auto-sync SKIPPED (autoServerSync=false in chrome.storage.local)`, { tabId, autoSync })
  }
}

export async function handleControlMessage(
  message: CaptureControlMessage,
  sender: chrome.runtime.MessageSender
): Promise<
  | StatusResponse
  | TabCaptureState
  | (TabCaptureState & { consent: ConsentState })
  | TabExportDataResponse
  | CachePreviewResponse
  | CachedPreviewResponse
  | ConsentState
  | ConsentResponseMessage
  | AlwaysLogHostsResponse
  | ProbeServerResponse
  | PushToServerResponse
  | { ok: boolean }
> {
  if (message.type === 'get-status') {
    const status = getActiveTabStatus()

    // If the tab is inactive, check whether it should auto-start via always-log.
    // This fixes a race where the popup opens before content-relay-ready fires,
    // showing the consent view for hosts that are already in the always-log list.
    if (status.mode === 'inactive' && status.tabId >= 0) {
      const tabId = status.tabId
      const tab = await chrome.tabs.get(tabId).catch(() => null)
      const url = tab?.url

      if (url) {
        const consent = await evaluateConsent(tabId, url)

        if (consent.hasConsent && consent.captureMode !== 'none') {
          const captureMode =
            consent.captureMode === 'debugger' ? 'debugger' : 'content-script'
          await setMode(tabId, captureMode)
          updateIconForTab(tabId)

          if (captureMode !== 'debugger') {
            try {
              await injectIntoTab(tabId)
            } catch (error) {
              console.error('[Loggy] Failed to inject content scripts on get-status:', error)
            }
          }

          if (captureMode === 'debugger') {
            attachToTab(tabId, (error) => {
              if (error) {
                console.error(
                  '[Loggy] Failed to attach debugger for always-log on get-status:',
                  error.message,
                )
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
            // Content script may not be loaded yet
          }

          return getActiveTabStatus()
        }
      }
    }

    return status
  }

  if (message.type === 'get-tab-status') {
    const tabId = sender.tab?.id
    if (typeof tabId !== 'number') {
      return { mode: 'inactive' as const, tabId: -1, logCount: 0, connected: false }
    }
    return getOrCreateTabState(tabId)
  }

  if (message.type === 'toggle-debugger') {
    const current = getOrCreateTabState(message.tabId)

    if (current.mode === 'devtools') {
      return { ...current, mode: current.mode }
    }

    const pendingResume = debuggerResumeTimersByTab.get(message.tabId)
    if (pendingResume) {
      clearTimeout(pendingResume)
      debuggerResumeTimersByTab.delete(message.tabId)
    }

    if (current.mode === 'debugger') {
      detachFromTab(message.tabId)
      const updated = await setMode(
        message.tabId,
        current.connected ? 'content-script' : 'inactive'
      )
      return updated
    }

    attachToTab(message.tabId, (error) => {
      if (error) {
        console.error('[Loggy] Failed to attach debugger:', error.message)
        void setMode(message.tabId, 'content-script')
      }
    })
    const updated = await setMode(message.tabId, 'debugger')
    return updated
  }

  if (message.type === 'content-relay-ready') {
    const tabId = message.tabId ?? sender.tab?.id
    if (typeof tabId !== 'number') {
      return { ok: false }
    }

    const url = message.url || (sender.tab?.url ?? '')
    const consent = await evaluateConsent(tabId, url)

    if (consent.hasConsent) {
      if (consent.captureMode !== 'debugger') {
        try {
          await injectIntoTab(tabId)
        } catch (error) {
          console.error('[Loggy] Failed to inject content scripts on relay ready:', error)
        }
      }

      const current = getOrCreateTabState(tabId)
      const updated: TabCaptureState = {
        ...current,
        connected: true,
        mode:
          consent.captureMode === 'debugger'
            ? 'debugger'
            : current.mode === 'inactive'
              ? 'content-script'
              : current.mode,
      }
      await setTabState(updated)
      updateIconForTab(tabId)

      if (consent.captureMode === 'debugger' && consent.reason === 'always-log') {
        attachToTab(tabId, (error) => {
          if (error) {
            console.error('[Loggy] Failed to attach debugger for always-log:', error.message)
            void setMode(tabId, 'content-script')
          }
        })
      }

      // Opportunistic poll: sync any data that was captured before the
      // content-relay connected or before auto-sync was enabled.
      void pollAndSyncTab(tabId)

      return { ...updated, consent }
    }

    // No consent: just update connected state and return
    const current = getOrCreateTabState(tabId)
    const updated: TabCaptureState = {
      ...current,
      connected: true,
    }
    await setTabState(updated)
    return { ...updated, consent }
  }

  if (message.type === 'panel-opened') {
    const current = getOrCreateTabState(message.tabId)

    if (current.mode !== 'devtools') {
      previousModeByTab.set(message.tabId, current.mode)
    }

    const pendingResume = debuggerResumeTimersByTab.get(message.tabId)
    if (pendingResume) {
      clearTimeout(pendingResume)
      debuggerResumeTimersByTab.delete(message.tabId)
    }

    if (isDebuggerAttached(message.tabId)) {
      detachFromTab(message.tabId)
    }

    const updated: TabCaptureState = {
      ...current,
      mode: 'devtools',
      connected: true,
    }
    await setTabState(updated)
    return updated
  }

  if (message.type === 'panel-closed') {
    const previousMode = previousModeByTab.get(message.tabId) ?? null
    previousModeByTab.delete(message.tabId)
    const current = getOrCreateTabState(message.tabId)

    const pendingResume = debuggerResumeTimersByTab.get(message.tabId)
    if (pendingResume) {
      clearTimeout(pendingResume)
      debuggerResumeTimersByTab.delete(message.tabId)
    }

    const fallbackMode: CaptureMode = current.connected ? 'content-script' : 'inactive'

    if (previousMode === 'debugger') {
      const resumeTimer = setTimeout(() => {
        const latest = getOrCreateTabState(message.tabId)
        if (latest.mode === 'devtools') {
          return
        }

        attachToTab(message.tabId, (error) => {
          if (error) {
            console.error('[Loggy] Failed to re-attach debugger:', error.message)
            const fallbackState = getOrCreateTabState(message.tabId)
            void setMode(message.tabId, fallbackState.connected ? 'content-script' : 'inactive')
            return
          }
          void setMode(message.tabId, 'debugger')
        })

        debuggerResumeTimersByTab.delete(message.tabId)
      }, 2000)

      debuggerResumeTimersByTab.set(message.tabId, resumeTimer)
    }

    const updated: TabCaptureState = {
      ...current,
      mode: fallbackMode,
    }
    await setTabState(updated)

    if (fallbackMode === 'content-script') {
      try {
        await injectIntoTab(message.tabId)
      } catch (error) {
        console.error('[Loggy] Failed to inject content scripts on panel close:', error)
      }

      try {
        await chrome.tabs.sendMessage(message.tabId, {
          type: 'consent-changed',
          hasConsent: true,
          captureMode: 'content-script',
        })
      } catch {
        // Content script may not be loaded yet
      }
    }

    // Fire auto-sync export on panel close so that data captured during
    // the panel session reaches the server, even if no new page activity
    // occurs after the panel is closed.
    const autoSync = await getAutoServerSync()
    if (autoSync) {
      debugLog('capture', 'background', `Panel closed, triggering auto-sync for tabId: ${message.tabId}`)
      await exportTabToServer(message.tabId)
    }

    return updated
  }

  if (message.type === 'get-tab-export-data') {
    const entries = await readStoredEntries(message.tabId)
    const consoleLogs: ConsoleMessage[] = []
    const networkEntries: HAREntry[] = []

    for (const stored of entries) {
      if (stored.kind === 'console') {
        consoleLogs.push(toConsoleMessage(stored.entry))
        continue
      }

      networkEntries.push(toHAREntry(stored.entry))
    }

    const defaults = createInitialState()
    const settingsResult = (await chrome.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
      string,
      unknown
    >
    const persistedSettings = mergePersistedSettings(
      settingsResult[LOGGY_PANEL_SETTINGS_STORAGE_KEY],
      createDefaultSettings()
    )

    const state = {
      ...defaults,
      ...persistedSettings,
      consoleLogs,
      networkEntries,
    }

    const filteredData = getFilteredPanelData(state)
    const markdown = await buildExportMarkdown(state)
    const tokenCount = estimateTokenCount(markdown)

    return {
      tokenCount,
      markdown,
      hasData: filteredData.consoleLogs.length > 0 || filteredData.networkEntries.length > 0,
      logCount: filteredData.consoleLogs.length + filteredData.networkEntries.length,
    }
  }

  if (message.type === 'request-consent') {
    const request: RequestConsentMessage = message
    const tabId = request.tabId ?? sender.tab?.id
    if (typeof tabId !== 'number') {
      return { hasConsent: false, captureMode: 'none' as const, reason: 'unknown-tab' }
    }

    let url = request.url || sender.tab?.url || ''
    if (!url) {
      try {
        const tab = await chrome.tabs.get(tabId)
        url = tab.url ?? ''
      } catch {
        // Unable to resolve URL — proceed with empty
      }
    }
    return evaluateConsent(tabId, url)
  }

  if (message.type === 'consent-response') {
    const response: ConsentResponseMessage = message
    return response
  }

  if (message.type === 'start-logging') {
    const startMessage: StartLoggingMessage = message
    const tabId = startMessage.tabId
    const current = getOrCreateTabState(tabId)

    if (current.mode === 'devtools') {
      return { ...current }
    }

    const updated = await setMode(tabId, 'content-script')
    updateIconForTab(tabId)

    try {
      await injectIntoTab(tabId)
    } catch (error) {
      console.error('[Loggy] Failed to inject content scripts:', error)
    }

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'consent-changed',
        hasConsent: true,
        captureMode: 'content-script',
      })
    } catch {
      // Content script may not be loaded yet
    }

    return updated
  }

  if (message.type === 'stop-logging') {
    const stopMessage: StopLoggingMessage = message
    const tabId = stopMessage.tabId
    const current = getOrCreateTabState(tabId)

    if (current.mode === 'devtools') {
      return { ...current }
    }

    if (current.mode === 'debugger' && isDebuggerAttached(tabId)) {
      detachFromTab(tabId)
    }

    const updated = await setMode(tabId, 'inactive')
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

    // Opportunistic poll: sync any data that accumulated during
    // page load, without waiting for the next alarm cycle.
    void pollAndSyncTab(tabId)

    return updated
  }

  if (message.type === 'clear-tab-data') {
    const clearMessage = message as ClearTabDataMessage
    const tabId = clearMessage.tabId

    // Remove stored capture entries
    const key = getStorageKeyForTab(tabId)
    await chrome.storage.session.remove(key)

    // Clear failed export buffer
    await clearFailedExportBuffer(tabId)

    // Reset log count in tab state
    const current = getOrCreateTabState(tabId)
    await setTabState({ ...current, logCount: 0 })

    // Clear page-level capture arrays (used by Firefox direct capture)
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          const w = window as any
          if (Array.isArray(w.__loggyConsoleLogs)) {
            w.__loggyConsoleLogs.length = 0
          }
          if (Array.isArray(w.__loggyNetworkLogs)) {
            w.__loggyNetworkLogs.length = 0
          }
        },
      })
    } catch {
      // Tab may not support scripting (e.g. chrome:// pages)
    }

    return { ok: true }
  }

  if (message.type === 'add-always-log') {
    const addMessage: AddAlwaysLogMessage = message
    await addAlwaysLogHost(addMessage.host)
    await registerAlwaysLogScriptsForHost(addMessage.host)

    try {
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (typeof tab.id !== 'number' || !tab.url) {
          continue
        }

        try {
          const parsedUrl = new URL(tab.url)
          if (parsedUrl.hostname === addMessage.host) {
            const consent = await evaluateConsent(tab.id, tab.url)
            if (consent.hasConsent) {
              const current = getOrCreateTabState(tab.id)
              if (current.mode === 'inactive') {
                await setMode(tab.id, 'content-script')
                updateIconForTab(tab.id)

                try {
                  await injectIntoTab(tab.id)
                } catch (error) {
                  console.error(`[Loggy] Failed to inject into tab ${tab.id}:`, error)
                }

                try {
                  await chrome.tabs.sendMessage(tab.id, {
                    type: 'consent-changed',
                    hasConsent: true,
                    captureMode: 'content-script',
                  })
                } catch {
                  // Content script may not be loaded
                }
              }
            }
          }
        } catch {
          // Invalid URL
        }
      }
    } catch {
      // Failed to query tabs
    }

    return { ok: true }
  }

  if (message.type === 'remove-always-log') {
    const removeMessage: RemoveAlwaysLogMessage = message
    await removeAlwaysLogHost(removeMessage.host)
    await unregisterAlwaysLogScriptsForHost(removeMessage.host)

    try {
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (typeof tab.id !== 'number' || !tab.url) {
          continue
        }

        try {
          const parsedUrl = new URL(tab.url)
          if (parsedUrl.hostname === removeMessage.host) {
            const consent = await evaluateConsent(tab.id, tab.url)
            if (!consent.hasConsent) {
              const current = getOrCreateTabState(tab.id)
              if (current.mode !== 'devtools' && current.mode !== 'inactive') {
                if (current.mode === 'debugger' && isDebuggerAttached(tab.id)) {
                  detachFromTab(tab.id)
                }

                await setMode(tab.id, 'inactive')
                updateIconForTab(tab.id)

                try {
                  await chrome.tabs.sendMessage(tab.id, {
                    type: 'consent-changed',
                    hasConsent: false,
                    captureMode: 'none',
                  })
                } catch {
                  // Content script may not be loaded
                }
              }
            }
          }
        } catch {
          // Invalid URL
        }
      }
    } catch {
      // Failed to query tabs
    }

    return { ok: true }
  }

  if (message.type === 'get-always-log-hosts') {
    const getAlwaysLogHostsMessage: GetAlwaysLogHostsMessage = message
    const hosts: AlwaysLogHost[] = await getAlwaysLogHosts()
    void getAlwaysLogHostsMessage
    return { type: 'always-log-hosts-response', hosts } as AlwaysLogHostsResponse
  }

  if (message.type === 'cache-preview') {
    const cacheMessage: CachePreviewMessage = message
    const id = crypto.randomUUID()
    previewCache.set(id, { markdown: cacheMessage.markdown, createdAt: Date.now() })
    return { id } as CachePreviewResponse
  }

  if (message.type === 'get-cached-preview') {
    const getMessage: GetCachedPreviewMessage = message
    const entry = previewCache.get(getMessage.id)

    if (!entry) {
      return { markdown: null } as CachedPreviewResponse
    }

    const age = Date.now() - entry.createdAt
    if (age > PREVIEW_CACHE_TTL_MS) {
      previewCache.delete(getMessage.id)
      return { markdown: null } as CachedPreviewResponse
    }

    previewCache.delete(getMessage.id)
    return { markdown: entry.markdown } as CachedPreviewResponse
  }

  if (message.type === 'probe-server') {
    const probeMessage = message as ProbeServerMessage
    console.log('[Loggy:bg] received probe-server message, url:', probeMessage.url)
    const connected = await probeServerFromBackground(probeMessage.url)
    console.log('[Loggy:bg] probe-server responding with connected:', connected)
    debugLog('message', 'background', `probe-server responding with connected: ${connected}`)
    return { connected } as ProbeServerResponse
  }

  if (message.type === 'push-to-server') {
    const pushMessage = message as PushToServerMessage
    debugLog('message', 'background', `push-to-server received from panel: url=${pushMessage.url} (${pushMessage.markdown.length} chars)`)
    const success = await pushToServer(pushMessage.url, pushMessage.markdown)
    debugLog('message', 'background', `push-to-server result: ${success}`, { senderTabId: sender.tab?.id })
    return { success } as PushToServerResponse
  }

  return { ok: false }
}

export function isCaptureMessage(message: unknown): message is CaptureMessage {
  if (typeof message !== 'object' || message === null || !('source' in message)) {
    return false
  }

  const source = (message as { source?: unknown }).source
  return source === 'console' || source === 'network'
}

export function isControlMessage(message: unknown): message is CaptureControlMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false
  }

  const type = (message as { type?: unknown }).type
  return (
    type === 'get-status' ||
    type === 'get-tab-status' ||
    type === 'toggle-debugger' ||
    type === 'content-relay-ready' ||
    type === 'panel-opened' ||
    type === 'panel-closed' ||
    type === 'get-tab-export-data' ||
    type === 'request-consent' ||
    type === 'consent-response' ||
    type === 'start-logging' ||
    type === 'stop-logging' ||
    type === 'clear-tab-data' ||
    type === 'add-always-log' ||
    type === 'remove-always-log' ||
    type === 'cache-preview' ||
    type === 'get-cached-preview' ||
    type === 'get-always-log-hosts' ||
    type === 'always-log-hosts-response' ||
    type === 'probe-server' ||
    type === 'push-to-server'
  )
}
