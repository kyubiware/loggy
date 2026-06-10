import { browser } from '../browser-apis/index.js'
import type { ExportData } from '../utils/formatter.js'
import { formatMarkdown } from '../utils/formatter.js'
import { pruneConsole, pruneNetwork } from '../utils/pruner.js'
import { getFilteredPanelData } from '../utils/filtered-data.js'
import { debugLog, getDebugEntries } from '../utils/debug-logger.js'
import { truncateToTokenLimit } from '../utils/token-estimate.js'
import { pushToServer } from './server-export.js'
import type { LoggyState } from '../types/state.js'

declare const __DEBUG__: boolean
const DEBUG = __DEBUG__

export async function buildExportMarkdown(state: LoggyState): Promise<string> {
  let url = 'N/A'
  try {
    const tab = await browser.tabs.query({ active: true, currentWindow: true })
    url = tab[0]?.url || 'N/A'
  } catch {
    // browser.tabs.query may fail in Firefox DevTools panel context
    // where chrome.tabs is undefined (moz-extension:// origin).
    // Fall back to 'N/A' — the export still works, just without the URL.
    debugLog('message', 'panel', 'buildExportMarkdown: tabs.query failed, using fallback URL')
  }
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
    ...(DEBUG ? { debugEntries: getDebugEntries() } : {}),
  }

  return truncateToTokenLimit(formatMarkdown(exportData), state.maxTokenLimit)
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
    debugLog('message', 'panel', 'triggerServerExport: SKIPPED - serverConnected is false')
    return
  }

  if (!state.serverUrl) {
    console.log('[Loggy:panel] triggerServerExport: SKIPPED - serverUrl is empty')
    debugLog('message', 'panel', 'triggerServerExport: SKIPPED - serverUrl is empty')
    return
  }

  void pushToServer(state.serverUrl, markdown).then((success) => {
    debugLog('message', 'panel', `triggerServerExport: pushToServer returned ${success}`)
    if (showToast) {
      if (success) {
        showToast('Exported to server!', 'success')
      } else {
        showToast('Server export failed', 'error')
      }
    }
  })
}
