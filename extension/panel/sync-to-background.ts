import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'
import type { SyncPanelDataMessage } from '../types/messages'
import { debugLog } from '../utils/debug-logger'

/**
 * Pushes the panel's current captured data to the background service worker.
 *
 * The panel captures console/network directly via chrome.devtools into React
 * state (devtools mode), bypassing background storage. This sync makes that
 * data available to the popup, which reads exclusively from background storage.
 * Fire-and-forget; failures are logged but never thrown.
 */
export function syncPanelDataToBackground(
  tabId: number,
  consoleLogs: ConsoleMessage[],
  networkEntries: HAREntry[]
): void {
  try {
    const message: SyncPanelDataMessage = {
      type: 'sync-panel-data',
      tabId,
      consoleLogs,
      networkEntries,
    }
    void chrome.runtime.sendMessage(message)
    debugLog('capture', 'panel', `sync-panel-data sent`, {
      tabId,
      consoleCount: consoleLogs.length,
      networkCount: networkEntries.length,
    })
  } catch (error) {
    debugLog('capture', 'panel', `sync-panel-data failed: ${String(error)}`, { tabId })
  }
}

/**
 * Cheap content fingerprint used to skip redundant background syncs when the
 * captured data has not changed between capture cycles. Catches new/removed
 * entries (count delta) and appends (last-timestamp change).
 */
export function panelDataFingerprint(
  consoleLogs: ConsoleMessage[],
  networkEntries: HAREntry[]
): string {
  const lastConsole = consoleLogs[consoleLogs.length - 1]?.timestamp ?? ''
  const lastNetwork = networkEntries[networkEntries.length - 1]?.startedDateTime ?? ''
  return `${consoleLogs.length}:${networkEntries.length}:${lastConsole}:${lastNetwork}`
}
