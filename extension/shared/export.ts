import { browser } from '../browser-apis/index.js'
import type { ExportData } from '../utils/formatter.js'
import { formatMarkdown } from '../utils/formatter.js'
import { pruneConsole, pruneNetwork } from '../utils/pruner.js'
import { getFilteredPanelData } from '../utils/filtered-data.js'
import { pushToServer } from './server-export.js'
import type { LoggyState } from '../types/state.js'

export async function buildExportMarkdown(state: LoggyState): Promise<string> {
  const tab = await browser.tabs.query({ active: true, currentWindow: true })
  const url = tab[0]?.url || 'N/A'
  const filteredData = getFilteredPanelData(state)

  const exportData: ExportData = {
    url,
    timestamp: new Date().toISOString(),
    includeAgentContext: state.includeAgentContext,
    includeResponseBodies: state.includeResponseBodies,
    truncateConsoleLogs: state.truncateConsoleLogs,
    deduplicateApiCalls: state.deduplicateApiCalls,
    consoleLogs: pruneConsole(filteredData.consoleLogs, {
      truncateConsoleLogs: state.truncateConsoleLogs,
      redactSensitiveInfo: state.redactSensitiveInfo,
    }),
    networkEntries: pruneNetwork(filteredData.networkEntries, {
      redactSensitiveInfo: state.redactSensitiveInfo,
      truncateResponseBodies: state.truncateResponseBodies,
    }),
  }

  return formatMarkdown(exportData)
}

/**
 * Fire-and-forget server export when server integration is enabled.
 * This intentionally never blocks clipboard export flow.
 */
type ShowToastFn = (message: string, type: 'success' | 'error') => void

export function triggerServerExport(
  state: LoggyState,
  markdown: string,
  showToast?: ShowToastFn
): void {
  console.log('[Loggy:panel] triggerServerExport called, serverConnected:', state.serverConnected, 'serverUrl:', state.serverUrl, 'markdown length:', markdown.length)
  if (!state.serverConnected) {
    console.log('[Loggy:panel] triggerServerExport: SKIPPED - serverConnected is false')
    return
  }

  if (!state.serverUrl) {
    console.log('[Loggy:panel] triggerServerExport: SKIPPED - serverUrl is empty')
    return
  }

  void pushToServer(state.serverUrl, markdown).then((success) => {
    if (showToast) {
      if (success) {
        showToast('Exported to server!', 'success')
      } else {
        showToast('Server export failed', 'error')
      }
    }
  })
}
