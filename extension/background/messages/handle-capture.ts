import {
  getOrCreateTabState,
  setTabState,
} from '../tab-state'
import { storeCapturedData } from '../entry-storage'
import {
  getAutoServerSync,
  exportTabToServer,
} from '../server-sync'
import { debugLog } from '../../utils/debug-logger'
import type {
  CaptureMessage,
  CaptureMode,
  TabCaptureState,
} from '../../types/messages'

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
