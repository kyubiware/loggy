import type { HAREntry } from '../types/har'
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
 * Extracts 4xx/5xx network failures from HAR entries and formats them
 * for the Debug Signals section of the Markdown export.
 */
export function formatNetworkFailureSignals(networkEntries: HAREntry[]): string {
  const _4xx = networkEntries.filter((e) => e.response.status >= 400 && e.response.status < 500)
  const _5xx = networkEntries.filter((e) => e.response.status >= 500 && e.response.status < 600)

  function getGroupKey(entry: HAREntry): string {
    try {
      const path = new URL(entry.request.url).pathname
      return `${entry.request.method}::${path}`
    } catch {
      return `${entry.request.method}::__invalid_url__`
    }
  }

  function formatFailureTag(entry: HAREntry, tag: string): string {
    try {
      const path = new URL(entry.request.url).pathname
      return `[${tag}] ${entry.request.method} ${path} → ${entry.response.status}`
    } catch {
      return `[${tag}] ${entry.request.method} ${entry.request.url} → ${entry.response.status}`
    }
  }

  function formatGrouped(tag: string, entries: HAREntry[]): string {
    // Group entries by (method, pathname)
    const groups = new Map<string, HAREntry[]>()
    for (const entry of entries) {
      const key = getGroupKey(entry)
      const group = groups.get(key)
      if (group) {
        group.push(entry)
      } else {
        groups.set(key, [entry])
      }
    }

    let output = ''
    for (const [, group] of groups) {
      const line = formatFailureTag(group[0], tag)
      if (group.length > 1) {
        output += `${line} (×${group.length})\n`
      } else {
        output += `${line}\n`
      }
    }
    return output
  }

  let output = ''
  if (_4xx.length > 0) {
    output += `- **Network 4xx Errors**: ${_4xx.length}\n`
    output += formatGrouped('network 4xx', _4xx)
    output += '\n'
  }
  if (_5xx.length > 0) {
    output += `- **Network 5xx Errors**: ${_5xx.length}\n`
    output += formatGrouped('network 5xx', _5xx)
    output += '\n'
  }
  return output
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
