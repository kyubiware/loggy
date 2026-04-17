import type { ConsoleMessage } from '../types/console'

/**
 * Consolidated console log entry with duplicates merged
 */
export interface ConsolidatedLog {
  firstTimestamp: string
  lastTimestamp: string
  level: ConsoleMessage['level']
  message: string
  count: number
}

function isEarlierTimestamp(a: string, b: string): boolean {
  return a.localeCompare(b) < 0
}

function isLaterTimestamp(a: string, b: string): boolean {
  return a.localeCompare(b) > 0
}

/**
 * Consolidates duplicate console logs by grouping them by level and message.
 * Counts occurrences and tracks the first and last timestamps.
 *
 * @param logs - Array of console messages to consolidate
 * @returns Array of consolidated logs with duplicates merged
 */
export function consolidateLogs(logs: ConsoleMessage[]): ConsolidatedLog[] {
  const byKey = new Map<string, ConsolidatedLog>()

  logs.forEach((log) => {
    const key = `${log.level}::${log.message}`
    const existing = byKey.get(key)

    if (!existing) {
      byKey.set(key, {
        firstTimestamp: log.timestamp,
        lastTimestamp: log.timestamp,
        level: log.level,
        message: log.message,
        count: 1,
      })
      return
    }

    if (isEarlierTimestamp(log.timestamp, existing.firstTimestamp)) {
      existing.firstTimestamp = log.timestamp
    }
    if (isLaterTimestamp(log.timestamp, existing.lastTimestamp)) {
      existing.lastTimestamp = log.timestamp
    }
    existing.count += 1
  })

  return Array.from(byKey.values())
}

/**
 * Sort comparator for console logs by severity (error first) and count (highest first).
 * Used within each severity level to show most frequent issues first.
 */
export function bySeverityThenCount(a: ConsolidatedLog, b: ConsolidatedLog): number {
  const severityRank: Record<ConsoleMessage['level'], number> = {
    error: 0,
    warn: 1,
    log: 2,
    info: 3,
    debug: 4,
  }

  const severityDelta = severityRank[a.level] - severityRank[b.level]
  if (severityDelta !== 0) return severityDelta

  const countDelta = b.count - a.count
  if (countDelta !== 0) return countDelta

  return a.firstTimestamp.localeCompare(b.firstTimestamp)
}

/**
 * Determines if a consolidated log is likely a failure signal based on level and message content.
 * Error-level logs are always considered failure signals. Warning-level logs are considered
 * failure signals if they contain failure-related keywords or error references.
 *
 * @param log - The consolidated log to evaluate
 * @returns True if the log is likely a failure signal, false otherwise
 */
export function isLikelyFailureSignal(log: ConsolidatedLog): boolean {
  if (log.level === 'error') return true

  const lower = log.message.toLowerCase()
  const failureKeywords = [
    'exception',
    'failed',
    'error boundary',
    'typeerror',
    'referenceerror',
    'cannot read',
    'uncaught',
    'unhandled',
    'rejection',
    'timeout',
    'network error',
    'cors',
    'syntaxerror',
  ]

  if (/\b[45]\d\d\b/.test(lower)) {
    return true
  }

  return (
    failureKeywords.some((keyword) => lower.includes(keyword)) ||
    (log.level === 'warn' && (lower.includes('error') || lower.includes('fail')))
  )
}

/**
 * Formats the timestamp range for a consolidated log entry.
 * If first and last timestamps are the same, returns a single timestamp.
 * Otherwise returns a range string like "start -> end".
 *
 * @param log - The consolidated log with timestamp information
 * @returns Formatted timestamp range string
 */
export function formatTimestampRange(log: ConsolidatedLog): string {
  if (log.firstTimestamp === log.lastTimestamp) return log.firstTimestamp
  return `${log.firstTimestamp} -> ${log.lastTimestamp}`
}

/**
 * Ranks failure signals in a consolidated log array.
 * Errors and failure-like warnings appear first, sorted by frequency.
 * Other logs follow, also sorted by frequency.
 *
 * @param logs - Array of consolidated logs to rank
 * @returns Array sorted with failure signals first
 */
export function rankFailureSignals(logs: ConsolidatedLog[]): ConsolidatedLog[] {
  return [...logs].sort(bySeverityThenCount)
}
