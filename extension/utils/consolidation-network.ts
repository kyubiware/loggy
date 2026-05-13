import type { HAREntry } from '../types/har'

/** Response body diff result between calls in a deduplicated group */
export interface BodyDiff {
  /** Index of the entry in the original group (0-based) */
  entryIndex: number
  /** Timestamp of the entry with this body */
  timestamp: string
  /** Whether the body differs from the first entry's body */
  hasDiff: boolean
  /** Line-level diff if body differs (only lines that changed) */
  diffLines?: string[]
}

/** A group of network entries that share the same dedup key */
export interface ConsolidatedNetworkEntry {
  /** All original entries in this group (preserved in order) */
  entries: HAREntry[]
  /** The dedup key: method::url::requestBody */
  key: string
  /** HTTP method */
  method: string
  /** Request URL */
  url: string
  /** Request body (from first entry) */
  requestBody?: string
  /** Whether all response bodies in the group are identical */
  identicalResponses: boolean
  /** Response body diffs (only populated when bodies differ) */
  bodyDiffs: BodyDiff[]
  /** Number of entries in this group */
  count: number
  /** Timestamps of all entries in the group */
  timestamps: string[]
}

/**
 * Builds a deduplication key for a network entry.
 * Format: method::url::postDataText
 *
 * @param entry - The HAR entry to build the key for
 * @returns The deduplication key string
 */
function buildDedupKey(entry: HAREntry): string {
  return `${entry.request.method}::${entry.request.url}::${entry.request.postData?.text || ''}`
}

/**
 * Computes line-level diffs between two arrays of lines.
 * Returns only changed lines with +/- prefixes.
 *
 * @param baseline - The baseline lines to compare against
 * @param current - The current lines to compare
 * @returns Array of diff lines with +/- prefixes
 */
function computeLineDiff(baseline: string[], current: string[]): string[] {
  const maxLen = Math.max(baseline.length, current.length)
  const diffs: string[] = []

  for (let i = 0; i < maxLen; i++) {
    const baseLine = baseline[i]
    const curLine = current[i]

    if (baseLine === curLine) continue

    if (baseLine === undefined) {
      diffs.push(`+ ${curLine}`)
    } else if (curLine === undefined) {
      diffs.push(`- ${baseLine}`)
    } else {
      diffs.push(`- ${baseLine}`)
      diffs.push(`+ ${curLine}`)
    }
  }

  return diffs
}

/**
 * Computes body diffs for a group of entries against the first entry as baseline.
 *
 * @param entries - The HAR entries in the group
 * @param bodies - The response bodies corresponding to each entry
 * @returns Array of BodyDiff objects for all entries
 */
function computeBodyDiffs(entries: HAREntry[], bodies: (string | undefined)[]): BodyDiff[] {
  const baseline = bodies[0] || ''
  const baselineLines = baseline.split('\n')

  return entries.map((entry, i) => {
    const body = bodies[i] || ''
    const hasDiff = body !== baseline
    let diffLines: string[] | undefined

    if (hasDiff) {
      const bodyLines = body.split('\n')
      diffLines = computeLineDiff(baselineLines, bodyLines)
    }

    return {
      entryIndex: i,
      timestamp: entry.startedDateTime,
      hasDiff,
      diffLines,
    }
  })
}

/**
 * Consolidates network entries by grouping them by method, URL, and request body.
 * Computes response body diffs within each group.
 *
 * @param entries - Array of HAR entries to consolidate
 * @returns Array of consolidated network entry groups
 */
export function consolidateNetworkEntries(entries: HAREntry[]): ConsolidatedNetworkEntry[] {
  const groups = new Map<string, HAREntry[]>()

  for (const entry of entries) {
    const key = buildDedupKey(entry)
    const group = groups.get(key)
    if (group) {
      group.push(entry)
    } else {
      groups.set(key, [entry])
    }
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0]
    const timestamps = group.map((e) => e.startedDateTime)
    const responseBodies = group.map((e) => e.response.content?.text)
    const identicalResponses = responseBodies.every((b) => b === responseBodies[0])

    return {
      entries: group,
      key: buildDedupKey(first),
      method: first.request.method,
      url: first.request.url,
      requestBody: first.request.postData?.text,
      identicalResponses,
      bodyDiffs: computeBodyDiffs(group, responseBodies),
      count: group.length,
      timestamps,
    }
  })
}
