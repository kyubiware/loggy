import {
  consolidateLogs,
  formatTimestampRange,
  isLikelyFailureSignal,
  rankFailureSignals,
} from '../utils/consolidation.js'
import type { FilteredPanelData } from '../utils/filtered-data.js'

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return `${str.slice(0, maxLength)}... [truncated]`
}

export function buildPreviewText(data: FilteredPanelData): string {
  const sections: string[] = []
  const consolidatedConsole = rankFailureSignals(consolidateLogs(data.consoleLogs))
  const failureSignals = consolidatedConsole.filter(isLikelyFailureSignal).slice(0, 10)

  if (consolidatedConsole.length > 0) {
    const debugSignalLines = [
      `Errors: ${data.consoleLogs.filter((log) => log.level === 'error').length}`,
      `Warnings: ${data.consoleLogs.filter((log) => log.level === 'warn').length}`,
      `Failure-like events: ${failureSignals.length}`,
      ...failureSignals.map((log) => {
        const timeRange = formatTimestampRange(log)
        const countPrefix = log.count > 1 ? `(${log.count}x) ` : ''
        return `- ${countPrefix}[${log.level}] ${timeRange}\n  ${truncate(log.message, 220)}`
      }),
    ]

    const consoleLines = consolidatedConsole.map((log) => {
      const timeRange = formatTimestampRange(log)
      const countPrefix = log.count > 1 ? `(${log.count}x) ` : ''
      return `${countPrefix}[${log.level}] ${timeRange}\n${truncate(log.message, 220)}`
    })

    sections.push(`=== Debug Signals ===\n\n${debugSignalLines.join('\n')}`)
    sections.push(`=== Console Logs (Consolidated) ===\n\n${consoleLines.join('\n\n')}`)
  }

  if (data.networkEntries.length > 0) {
    const networkLines = data.networkEntries
      .map((entry) => {
        const url = entry.request?.url || 'N/A'
        const method = entry.request?.method || 'N/A'
        const status = entry.response?.status || 'N/A'
        return `[${method}] ${status} ${url}`
      })
      .join('\n\n')
    sections.push(`=== Network Entries ===\n\n${networkLines}`)
  }

  if (sections.length === 0) {
    return 'No console logs or network entries match the current filters.\nData refreshes automatically while this panel is open.'
  }

  return `${sections.join('\n\n')}\n\n`
}

export function buildStatsText(data: FilteredPanelData): string {
  const uniqueConsoleCount = new Set(data.consoleLogs.map((log) => `${log.level}::${log.message}`))
    .size
  return `${data.consoleLogs.length} console logs (${uniqueConsoleCount} unique), ${data.networkEntries.length} network entries`
}
