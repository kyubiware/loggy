import {
  getOrCreateTabState,
  setMode,
  setTabState,
  updateIconForTab,
  debuggerResumeTimersByTab,
  explicitlyStoppedByTab,
} from '../tab-state'
import { evaluateConsent } from '../consent'
import { injectIntoTab } from '../content-scripts'
import {
  attachToTab,
  detachFromTab,
  isAttached as isDebuggerAttached,
} from '../../capture/debugger-capture'
import { pollAndSyncTab } from '../polling'
import type {
  ConsentResponseMessage,
  ConsentState,
  ContentRelayReadyMessage,
  RequestConsentMessage,
  TabCaptureState,
} from '../../types/messages'

export async function handleToggleDebugger(tabId: number): Promise<TabCaptureState> {
  const current = getOrCreateTabState(tabId)

  if (current.mode === 'devtools') {
    return { ...current, mode: current.mode }
  }

  const pendingResume = debuggerResumeTimersByTab.get(tabId)
  if (pendingResume) {
    clearTimeout(pendingResume)
    debuggerResumeTimersByTab.delete(tabId)
  }

  if (current.mode === 'debugger') {
    detachFromTab(tabId)
    const updated = await setMode(
      tabId,
      current.connected ? 'content-script' : 'inactive',
    )
    return updated
  }

  attachToTab(tabId, (error) => {
    if (error) {
      console.error('[Loggy] Failed to attach debugger:', error.message)
      void setMode(tabId, 'content-script')
    }
  })
  const updated = await setMode(tabId, 'debugger')
  return updated
}

export async function handleContentRelayReady(
  message: ContentRelayReadyMessage,
  sender: chrome.runtime.MessageSender,
): Promise<
  (TabCaptureState & { consent: ConsentState }) | { ok: boolean }
> {
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

export async function handleStartLogging(tabId: number): Promise<TabCaptureState> {
  explicitlyStoppedByTab.delete(tabId)
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

export async function handleStopLogging(tabId: number): Promise<TabCaptureState> {
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

  explicitlyStoppedByTab.add(tabId)

  return updated
}

export async function handleRequestConsent(
  message: RequestConsentMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ConsentState> {
  const tabId = message.tabId ?? sender.tab?.id
  if (typeof tabId !== 'number') {
    return { hasConsent: false, captureMode: 'none' as const, reason: 'unknown-tab' }
  }

  let url = message.url || sender.tab?.url || ''
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

export function handleConsentResponse(
  message: ConsentResponseMessage,
): ConsentResponseMessage {
  return message
}
