import type { ConsolidatedLog } from './consolidation.js'
import {
  bySeverityThenCount,
  consolidateLogs,
  formatTimestampRange,
  isLikelyFailureSignal,
} from './consolidation.js'
import { escapeMarkdown, truncate } from './formatter-strings'

// Re-export for backwards compatibility
export type { ConsolidatedLog as ConsolidatedConsoleLog }
export {
  bySeverityThenCount,
  consolidateLogs as consolidateConsoleLogs,
  formatTimestampRange,
  isLikelyFailureSignal,
}

/**
 * Formats a single consolidated console message as table row
 * @param log - Consolidated console message to format
 * @param truncateConsoleLogs - Whether to truncate the message (default: true)
 * @returns Markdown table row string
 */
export function formatConsoleLog(
  log: ConsolidatedLog,
  truncateConsoleLogs: boolean = true
): string {
  const message = truncateConsoleLogs ? truncate(log.message, 260) : log.message
  return `| ${log.firstTimestamp} | ${log.lastTimestamp} | ${log.level} | ${log.count} | ${escapeMarkdown(message)} |`
}
