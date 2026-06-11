import type { HAREntry } from '../types/har'
import type { ConsolidatedNetworkEntry } from './consolidation-network'
import { formatFilteredHeaders, getLanguageFromMime, shouldUseCodeBlock } from './formatter-network'
import { escapeMarkdown, truncate } from './formatter-strings'

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
    output += `#### Request Headers\n`
    output += '```\n'
    output += formatFilteredHeaders(request.headers, { side: 'request', isSuccess })
    output += '\n```\n\n'
  }

  if (request.postData?.text) {
    output += `#### Request Body\n`
    if (shouldUseCodeBlock(request.postData.mimeType)) {
      const lang = getLanguageFromMime(request.postData.mimeType)
      output += `\`\`\`${lang}\n`
      output += escapeMarkdown(truncate(request.postData.text, 5000))
      output += '\n```\n\n'
    } else {
      output += '```\n'
      output += escapeMarkdown(truncate(request.postData.text, 5000))
      output += '\n```\n\n'
    }
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
  truncateResponseBodies: boolean = true
): string {
  let output = ''

  if (!isMinimal) {
    output += `#### Response Headers\n`
    output += '```\n'
    output += formatFilteredHeaders(response.headers, { side: 'response', isSuccess })
    output += '\n```\n\n'

    if (includeResponseBodies && response.content?.text && shouldUseCodeBlock(mimeType)) {
      const lang = getLanguageFromMime(mimeType)
      const contentText = truncateResponseBodies
        ? truncate(response.content.text, 5000)
        : response.content.text
      output += `#### Response Content\n`
      output += `\`\`\`${lang}\n`
      output += escapeMarkdown(contentText)
      output += '\n```\n\n'
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
  truncateResponseBodies: boolean = true
): string {
  let output = ''
  const mimeType = response?.content?.mimeType || 'unknown'

  if (!isMinimal) {
    output += `#### Response Headers\n`
    output += '```\n'
    output += formatFilteredHeaders(response.headers, { side: 'response', isSuccess })
    output += '\n```\n\n'

    if (includeResponseBodies && response.content?.text && shouldUseCodeBlock(mimeType)) {
      const lang = getLanguageFromMime(mimeType)
      const contentText = truncateResponseBodies
        ? truncate(response.content.text, 5000)
        : response.content.text
      if (group.identicalResponses) {
        output += `#### Response Content\n`
        output += `\`\`\`${lang}\n`
        output += escapeMarkdown(contentText)
        output += '\n```\n'
        output += `(×${group.count} identical responses)\n\n`
      } else {
        output += `#### Response Content (first call)\n`
        output += `\`\`\`${lang}\n`
        output += escapeMarkdown(contentText)
        output += '\n```\n\n'

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
 * Formats consolidated group metadata (time, timestamps, calls, duration, status, size, mime)
 */
export function formatConsolidatedMeta(
  group: ConsolidatedNetworkEntry,
  response: HAREntry['response'],
  time: number | undefined,
  size: string,
  mimeType: string
): string {
  const firstTime = group.timestamps[0]
  const lastTime = group.timestamps[group.timestamps.length - 1]

  let output = `- **Time**: ${firstTime}`
  if (firstTime !== lastTime) {
    output += ` -> ${lastTime}`
  }
  output += '\n'

  output += `- **Calls**: ${group.count}\n`
  output += `- **Timestamps**: ${group.timestamps.join(', ')}\n`
  output += `- **Duration**: ${time ? `${time}ms (first call)` : 'N/A'}\n`
  output += `- **Status**: ${response.status} ${response.statusText}\n`
  output += `- **Size**: ${size}\n`
  output += `- **MIME Type**: ${mimeType}\n\n`

  return output
}
