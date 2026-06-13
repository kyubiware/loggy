import type { ConsolidatedLog } from './consolidation.js'
import {
  bySeverityThenCount,
  consolidateLogs,
  formatTimestampRange,
  isLikelyFailureSignal,
} from './consolidation.js'
import { escapeMarkdown, formatRelativeOffset, truncate } from './formatter-strings'

// Re-export for backwards compatibility
export type { ConsolidatedLog as ConsolidatedConsoleLog }
export {
  bySeverityThenCount,
  consolidateLogs as consolidateConsoleLogs,
  formatTimestampRange,
  isLikelyFailureSignal,
}

/**
 * Formats a single consolidated console message as table row.
 * The first-seen column gets a relative `t+<offset>` suffix when an
 * anchor is provided; the last-seen column stays ISO-only so repeated
 * rows stay compact.
 * @param log - Consolidated console message to format
 * @param truncateConsoleLogs - Whether to truncate the message (default: true)
 * @param anchor - Epoch ms of the session anchor; optional
 * @returns Markdown table row string
 */
export function formatConsoleLog(
  log: ConsolidatedLog,
  truncateConsoleLogs: boolean = true,
  anchor?: number
): string {
  const message = truncateConsoleLogs ? truncate(log.message, 260) : log.message
  const offset = formatRelativeOffset(log.firstTimestamp, anchor)
  const firstCol = offset ? `${log.firstTimestamp} (${offset})` : log.firstTimestamp
  return `| ${firstCol} | ${log.lastTimestamp} | ${log.level} | ${log.count} | ${escapeMarkdown(message)} |`
}
