import type { HAREntry } from '../types/har'
import type { ConsolidatedNetworkEntry } from './consolidation-network'
import { formatFilteredHeaders, getLanguageFromMime, shouldUseCodeBlock } from './formatter-network'
import { formatBytes, formatRelativeOffset, truncate, truncateJSON } from './formatter-strings'
import { sketchJsonBody } from './schema-sketch'

/**
 * Maximum length of a request or response body in the rendered Markdown export.
 * Bodies are truncated once, at the formatter layer, with JSON-aware boundary
 * detection (see `truncateJSON`).
 */
export const MAX_BODY_LENGTH = 8000

/**
 * Picks the right truncation function for a body given its MIME type.
 * JSON bodies get a structurally-safe cut at a closed container; everything
 * else falls through to the byte-count truncate.
 */
function truncateBody(text: string, mimeType: string | undefined): string {
  if (getLanguageFromMime(mimeType) === 'json') {
    return truncateJSON(text, MAX_BODY_LENGTH)
  }
  return truncate(text, MAX_BODY_LENGTH)
}

/**
 * Formats request headers and body section (shared between regular and consolidated entries)
 */
export function formatRequestSection(
  request: HAREntry['request'],
  isSuccess: boolean,
  isMinimal: boolean
): string {
  let output = ''

  if (!isMinimal) {
    const formatted = formatFilteredHeaders(request.headers, { side: 'request', isSuccess })
    if (formatted) {
      output += `#### Request Headers\n`
      output += '```\n'
      output += formatted
      output += '\n```\n\n'
    }
  }

  if (request.postData?.text) {
    const mimeType = request.postData.mimeType
    const lang = getLanguageFromMime(mimeType)
    output += `#### Request Body\n`
    if (shouldUseCodeBlock(mimeType)) {
      output += `\`\`\`${lang}\n`
    } else {
      output += '```\n'
    }
    // Body lives inside a fenced code block, so Markdown escaping is not
    // needed (and would mangle the `*` in the `/* truncated */` marker).
    output += truncateBody(request.postData.text, mimeType)
    output += '\n```\n\n'
  }

  return output
}

/**
 * Formats response headers and content section (for regular entries)
 */
export function formatResponseSection(
  response: HAREntry['response'],
  mimeType: string,
  isSuccess: boolean,
  isMinimal: boolean,
  includeResponseBodies: boolean,
  responseBodyMode: 'smart' | 'full' = 'smart',
  isElevated: boolean = false
): string {
  let output = ''

  if (!isMinimal) {
    const formatted = formatFilteredHeaders(response.headers, { side: 'response', isSuccess })
    if (formatted) {
      output += `#### Response Headers\n`
      output += '```\n'
      output += formatted
      output += '\n```\n\n'
    }

    if (includeResponseBodies && response.content?.text && shouldUseCodeBlock(mimeType)) {
      const lang = getLanguageFromMime(mimeType)
      const text = response.content.text

      if (responseBodyMode === 'full' || isElevated) {
        // Full mode or elevated entry — emit body unchanged (no MAX_BODY_LENGTH)
        output += `#### Response Content\n`
        output += `\`\`\`${lang}\n`
        output += text
        output += '\n```\n\n'
      } else {
        // Smart mode, non-elevated — elide body with schema sketch
        output += `- **Body elided (smart mode)**: ${sketchJsonBody(text, mimeType)}\n\n`
      }
    }
  }

  return output
}

/**
 * Formats response headers and content section for consolidated entries
 * (includes identical responses and response diffs)
 */
export function formatConsolidatedResponseSection(
  group: ConsolidatedNetworkEntry,
  response: HAREntry['response'],
  isSuccess: boolean,
  isMinimal: boolean,
  includeResponseBodies: boolean,
  responseBodyMode: 'smart' | 'full' = 'smart',
  isElevated: boolean = false
): string {
  let output = ''
  const mimeType = response?.content?.mimeType || 'unknown'

  if (!isMinimal) {
    const formatted = formatFilteredHeaders(response.headers, { side: 'response', isSuccess })
    if (formatted) {
      output += `#### Response Headers\n`
      output += '```\n'
      output += formatted
      output += '\n```\n\n'
    }

    if (includeResponseBodies && response.content?.text && shouldUseCodeBlock(mimeType)) {
      const lang = getLanguageFromMime(mimeType)
      const text = response.content.text

      const showFullBody = responseBodyMode === 'full' || isElevated
      const contentText = showFullBody ? text : ''

      if (group.identicalResponses) {
        if (showFullBody) {
          output += `#### Response Content\n`
          output += `\`\`\`${lang}\n`
          output += contentText
          output += '\n```\n'
          output += `(×${group.count} identical responses)\n\n`
        } else {
          output += `- **Body elided (smart mode)**: ${sketchJsonBody(text, mimeType)}\n\n`
        }
      } else {
        if (showFullBody) {
          output += `#### Response Content (first call)\n`
          output += `\`\`\`${lang}\n`
          output += contentText
          output += '\n```\n\n'
        } else {
          output += `- **Body elided (smart mode)**: ${sketchJsonBody(text, mimeType)}\n\n`
        }

        // Diffs are always rendered — they're compact and valuable even in smart mode
        for (const diff of group.bodyDiffs) {
          if (!diff.hasDiff || !diff.diffLines) continue
          output += `#### Response Diff — Call ${diff.entryIndex + 1} (${diff.timestamp})\n`
          output += '```diff\n'
          output += diff.diffLines.join('\n')
          output += '\n```\n\n'
        }
      }
    }
  }

  return output
}

/**
 * Formats consolidated group metadata (time, timestamps, calls, duration, status, size, mime).
 * The Time bullet gets a relative offset against the session anchor for the
 * FIRST-SEEN timestamp only; subsequent timestamps stay ISO-only to keep the
 * compact range readable.
 */
export function formatConsolidatedMeta(
  group: ConsolidatedNetworkEntry,
  response: HAREntry['response'],
  time: number | undefined,
  emittedBytes: number,
  mimeType: string,
  index: number,
  anchor: number | undefined
): string {
  const firstTime = group.timestamps[0]
  const lastTime = group.timestamps[group.timestamps.length - 1]
  const firstOffset = formatRelativeOffset(firstTime, anchor)

  let output = `- **Time**: ${firstTime}`
  if (firstOffset) {
    output += ` (${firstOffset})`
  }
  if (firstTime !== lastTime) {
    output += ` -> ${lastTime}`
  }
  output += '\n'

  output += `- **Calls**: ${group.count}\n`
  output += `- **Timestamps**: ${group.timestamps.join(', ')}\n`
  if (time) {
    output += `- **Duration**: ${time}ms (first call)\n`
  }
  output += `- **Status**: ${response.status} ${response.statusText}\n`
  if (emittedBytes > 0) {
    output += `- **Size**: ${formatBytes(emittedBytes)}\n`
  }
  output += `- **MIME Type**: ${mimeType}\n\n`
  // `index` is currently used by callers to align headings; the consolidated
  // heading is emitted by formatConsolidatedNetworkEntry, so this function
  // accepts the param for symmetry and future use without warning about an
  // unused binding.
  void index

  return output
}
