import { browser } from '../browser-apis/index.js'
import type { ExportData } from '../utils/formatter.js'
import { formatMarkdown } from '../utils/formatter.js'
import { pruneConsole, pruneNetwork } from '../utils/pruner.js'
import { getFilteredPanelData } from './filtered-data.js'
import { pushToServer } from './server-export.js'
import type { LoggyState } from './state.js'

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
    consoleLogs: pruneConsole(filteredData.consoleLogs, {
      truncateConsoleLogs: state.truncateConsoleLogs,
      redactSensitiveInfo: state.redactSensitiveInfo,
    }),
    networkEntries: pruneNetwork(filteredData.networkEntries, {
      redactSensitiveInfo: state.redactSensitiveInfo,
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
  if (!state.serverConnected) {
    return
  }

  if (!state.serverUrl) {
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
