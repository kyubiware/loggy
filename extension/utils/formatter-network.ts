import type { HAREntry } from '../types/har'
import { escapeMarkdown, formatBytes, truncate } from './formatter-strings'

/** HTTP/2 pseudo-headers that duplicate info already in the URL/method line */
const SUPPRESSED_PSEUDO_HEADERS = new Set([':authority', ':method', ':path', ':scheme'])

/** Request headers that provide no debugging value */
const SUPPRESSED_REQUEST_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'available-dictionary',
  'downlink',
  'rtt',
  'priority',
  'x-browser-channel',
  'x-browser-copyright',
  'x-browser-validation',
  'x-browser-year',
  'x-client-data',
])

/** Header name prefixes to suppress (case-insensitive) — covers all sec-ch-ua variants */
const SUPPRESSED_HEADER_PREFIXES = ['sec-ch-ua']

/** Headers whose values should be summarized (count + size) instead of displayed in full */
const SUMMARIZED_HEADERS = new Set(['cookie', 'set-cookie'])

/** Response headers to suppress on successful (2xx) responses */
const SUPPRESSED_RESPONSE_HEADERS_ON_SUCCESS = new Set([
  'alt-svc',
  'content-security-policy',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
  'report-to',
  'x-xss-protection',
  'date',
])

/**
 * Checks if a request header should be suppressed from output.
 * Case-insensitive matching. Pseudo-headers, browser internals, and
 * sec-ch-ua client hints are suppressed.
 */
function isSuppressedRequestHeader(name: string): boolean {
  const lower = name.toLowerCase()
  if (SUPPRESSED_PSEUDO_HEADERS.has(lower)) return true
  if (SUPPRESSED_REQUEST_HEADERS.has(lower)) return true
  return SUPPRESSED_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

/**
 * Checks if a response header should be suppressed.
 * On successful responses (2xx), additional low-signal headers are suppressed.
 */
function isSuppressedResponseHeader(name: string, isSuccess: boolean): boolean {
  const lower = name.toLowerCase()
  if (isSuccess && SUPPRESSED_RESPONSE_HEADERS_ON_SUCCESS.has(lower)) return true
  return false
}

/**
 * Summarizes a cookie header value into a compact format.
 * For request `cookie` header: splits on `;` to count individual cookies.
 * Returns format like `[8 cookies, 1.2KB]`
 */
function summarizeCookies(value: string): string {
  const cookies = value
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
  const sizeKB = (value.length / 1024).toFixed(1)
  return `[${cookies.length} cookie${cookies.length !== 1 ? 's' : ''}, ${sizeKB}KB]`
}

/**
 * Formats headers with filtering and summarization applied.
 * - Suppresses low-value headers based on context (request vs response, status)
 * - Summarizes cookie/set-cookie headers
 * - Falls back to standard formatting for remaining headers
 */
function formatFilteredHeaders(
  headers: { name: string; value: string }[] | undefined,
  context: { side: 'request' | 'response'; isSuccess: boolean }
): string {
  if (!headers || headers.length === 0) return 'None'

  const { side, isSuccess } = context
  const result: string[] = []
  const summarizedNames = new Set<string>()

  for (const h of headers) {
    const lower = h.name.toLowerCase()

    // Summarize cookie headers (handle multiple set-cookie headers)
    if (SUMMARIZED_HEADERS.has(lower)) {
      if (!summarizedNames.has(lower)) {
        summarizedNames.add(lower)
        if (lower === 'set-cookie') {
          // Collect all set-cookie headers for combined summary
          const allSetCookie = headers.filter((hh) => hh.name.toLowerCase() === 'set-cookie')
          const totalSize = allSetCookie.reduce((sum, hh) => sum + hh.value.length, 0)
          const sizeKB = (totalSize / 1024).toFixed(1)
          result.push(
            `  ${escapeMarkdown(h.name)}: [${allSetCookie.length} cookie${allSetCookie.length !== 1 ? 's' : ''} set, ${sizeKB}KB]`
          )
        } else {
          result.push(`  ${escapeMarkdown(h.name)}: ${summarizeCookies(h.value)}`)
        }
      }
      continue
    }

    // Apply suppression rules
    if (side === 'request' && isSuppressedRequestHeader(lower)) continue
    if (side === 'response' && isSuppressedResponseHeader(lower, isSuccess)) continue

    result.push(`  ${escapeMarkdown(h.name)}: ${escapeMarkdown(h.value)}`)
  }

  return result.length > 0 ? result.join('\n') : 'None'
}

/**
 * Detects content type and returns appropriate language tag for code blocks
 * @param mimeType - MIME type of content
 * @returns Language identifier for Markdown code block
 */
function getLanguageFromMime(mimeType: string | undefined): string {
  if (!mimeType) return ''
  const lower = mimeType.toLowerCase()

  if (lower.includes('json')) return 'json'
  if (lower.includes('xml')) return 'xml'
  if (lower.includes('html')) return 'html'
  if (lower.includes('javascript')) return 'javascript'
  if (lower.includes('css')) return 'css'

  return 'text'
}

/**
 * Determines if content should be displayed as code block
 * @param mimeType - MIME type of content
 * @returns True if content should be in code block
 */
function shouldUseCodeBlock(mimeType: string | undefined): boolean {
  if (!mimeType) return false
  const lower = mimeType.toLowerCase()
  return (
    lower.includes('json') ||
    lower.includes('xml') ||
    lower.includes('html') ||
    lower.includes('javascript') ||
    lower.includes('css') ||
    lower.includes('text')
  )
}

/**
 * Formats headers array as key-value pairs
 * @param headers - Array of HAR headers
 * @returns Formatted string of headers
 */
function _formatHeaders(headers: { name: string; value: string }[] | undefined): string {
  if (!headers || headers.length === 0) return 'None'
  return headers.map((h) => `  ${escapeMarkdown(h.name)}: ${escapeMarkdown(h.value)}`).join('\n')
}

/**
 * Formats a single network entry as detailed section
 * @param entry - HAR entry to format
 * @param options - Formatting options
 * @returns Markdown section string
 */
export function formatNetworkEntry(
  entry: HAREntry,
  options: { includeResponseBodies: boolean }
): string {
  const { request, response, startedDateTime, time } = entry
  const { includeResponseBodies } = options
  const size = response?.content?.size ? formatBytes(response.content.size) : 'N/A'
  const mimeType = response?.content?.mimeType || 'unknown'
  const isSuccess = response.status >= 200 && response.status < 300
  const isMinimal = response.status === 204

  let output = `### ${escapeMarkdown(request.method)} ${escapeMarkdown(request.url)}\n\n`
  output += `- **Time**: ${startedDateTime}\n`
  output += `- **Duration**: ${time ? `${time}ms` : 'N/A'}\n`
  output += `- **Status**: ${response.status} ${response.statusText}\n`
  output += `- **Size**: ${size}\n`
  output += `- **MIME Type**: ${mimeType}\n\n`

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

  if (!isMinimal) {
    output += `#### Response Headers\n`
    output += '```\n'
    output += formatFilteredHeaders(response.headers, { side: 'response', isSuccess })
    output += '\n```\n\n'

    if (includeResponseBodies && response.content?.text && shouldUseCodeBlock(mimeType)) {
      const lang = getLanguageFromMime(mimeType)
      output += `#### Response Content\n`
      output += `\`\`\`${lang}\n`
      output += escapeMarkdown(truncate(response.content.text, 5000))
      output += '\n```\n\n'
    }
  }

  return output
}
