import {
  previousModeByTab,
  debuggerResumeTimersByTab,
  explicitlyStoppedByTab,
  getOrCreateTabState,
  setTabState,
  setMode,
  getActiveTabStatus,
  updateIconForTab,
} from '../tab-state'
import { evaluateConsent } from '../consent'
import { injectIntoTab } from '../content-scripts'
import {
  attachToTab,
  detachFromTab,
  isAttached as isDebuggerAttached,
} from '../../capture/debugger-capture'
import { getAutoServerSync, exportTabToServer } from '../server-sync'
import { debugLog } from '../../utils/debug-logger'
import {
  type StatusResponse,
  type TabCaptureState,
  type ConsentState,
  type CaptureMode,
} from '../../types/messages'

export async function handleGetStatus(
  sender: chrome.runtime.MessageSender,
): Promise<StatusResponse | TabCaptureState | (TabCaptureState & { consent: ConsentState })> {
  const status = getActiveTabStatus()

  // If the tab is inactive, check whether it should auto-start via always-log.
  // This fixes a race where the popup opens before content-relay-ready fires,
  // showing the consent view for hosts that are already in the always-log list.
  // Skip auto-activation if the user explicitly stopped logging for this tab.
  if (status.mode === 'inactive' && !explicitlyStoppedByTab.has(status.tabId) && status.tabId >= 0) {
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
            console.error(
              '[Loggy] Failed to inject content scripts on get-status:',
              error,
            )
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

export async function handleGetTabStatus(
  sender: chrome.runtime.MessageSender,
): Promise<TabCaptureState> {
  const tabId = sender.tab?.id
  if (typeof tabId !== 'number') {
    return { mode: 'inactive' as const, tabId: -1, logCount: 0, connected: false }
  }
  return getOrCreateTabState(tabId)
}

export async function handlePanelOpened(tabId: number): Promise<TabCaptureState> {
  const current = getOrCreateTabState(tabId)

  if (current.mode !== 'devtools') {
    previousModeByTab.set(tabId, current.mode)
  }

  const pendingResume = debuggerResumeTimersByTab.get(tabId)
  if (pendingResume) {
    clearTimeout(pendingResume)
    debuggerResumeTimersByTab.delete(tabId)
  }

  if (isDebuggerAttached(tabId)) {
    detachFromTab(tabId)
  }

  const updated: TabCaptureState = {
    ...current,
    mode: 'devtools',
    connected: true,
  }
  await setTabState(updated)
  return updated
}

export async function handlePanelClosed(tabId: number): Promise<TabCaptureState> {
  const previousMode = previousModeByTab.get(tabId) ?? null
  previousModeByTab.delete(tabId)
  const current = getOrCreateTabState(tabId)

  const pendingResume = debuggerResumeTimersByTab.get(tabId)
  if (pendingResume) {
    clearTimeout(pendingResume)
    debuggerResumeTimersByTab.delete(tabId)
  }

  const fallbackMode: CaptureMode = current.connected ? 'content-script' : 'inactive'

  if (previousMode === 'debugger') {
    const resumeTimer = setTimeout(() => {
      const latest = getOrCreateTabState(tabId)
      if (latest.mode === 'devtools') {
        return
      }

      attachToTab(tabId, (error) => {
        if (error) {
          console.error('[Loggy] Failed to re-attach debugger:', error.message)
          const fallbackState = getOrCreateTabState(tabId)
          void setMode(
            tabId,
            fallbackState.connected ? 'content-script' : 'inactive',
          )
          return
        }
        void setMode(tabId, 'debugger')
      })

      debuggerResumeTimersByTab.delete(tabId)
    }, 2000)

    debuggerResumeTimersByTab.set(tabId, resumeTimer)
  }

  const updated: TabCaptureState = {
    ...current,
    mode: fallbackMode,
  }
  await setTabState(updated)

  if (fallbackMode === 'content-script') {
    try {
      await injectIntoTab(tabId)
    } catch (error) {
      console.error('[Loggy] Failed to inject content scripts on panel close:', error)
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
  }

  // Fire auto-sync export on panel close so that data captured during
  // the panel session reaches the server, even if no new page activity
  // occurs after the panel is closed.
  const autoSync = await getAutoServerSync()
  if (autoSync) {
    debugLog(
      'capture',
      'background',
      `Panel closed, triggering auto-sync for tabId: ${tabId}`,
    )
    await exportTabToServer(tabId)
  }

  return updated
}
