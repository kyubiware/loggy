/**
 * Data Pruning Engine for Loggy Chrome Extension
 * Removes binary content and truncates large data to optimize storage
 */

import type { ConsoleMessage } from '../types/console'
import type { HARContent, HAREntry } from '../types/har'
import { redactHAREntry, redactString } from './redact'

/**
 * Pruning configuration constants
 */
const PRUNE_CONFIG = {
  MAX_LOG_LENGTH: 500,
  MAX_STACK_DEPTH: 10,
  BINARY_MIME_TYPES: [
    'image/',
    'video/',
    'audio/',
    'font/',
    'application/octet-stream',
    'application/pdf',
  ],
} as const

/**
 * Keywords that indicate a failure or error in console messages
 */
const FAILURE_KEYWORDS = [
  'error',
  'exception',
  'uncaught',
  'unhandled',
  'typeerror',
  'referenceerror',
  'syntaxerror',
  'rangeerror',
  'urierror',
  'evalerror',
  'aggregateerror',
  'failed',
  'abort',
  'reject',
] as const

/**
 * Prunes console log messages by truncating long messages
 * @param logs - Array of console messages to prune
 * @param options - Options to control truncation behavior
 * @param options.truncateConsoleLogs - Whether to truncate messages (default: true)
 * @param options.redactSensitiveInfo - Whether to redact sensitive data (default: true)
 * @returns New array with pruned messages (original not mutated)
 */
export function pruneConsole(
  logs: ConsoleMessage[],
  options?: { truncateConsoleLogs?: boolean; redactSensitiveInfo?: boolean }
): ConsoleMessage[] {
  const shouldTruncate = options?.truncateConsoleLogs !== false
  const shouldRedact = options?.redactSensitiveInfo !== false
  return logs.map((log) => {
    const message = shouldTruncate
      ? truncate(log.message, PRUNE_CONFIG.MAX_LOG_LENGTH, isFailureLike(log.message))
      : log.message

    if (!shouldTruncate) {
      return {
        ...log,
        message: shouldRedact ? redactString(message) : message,
      }
    }

    return {
      ...log,
      message: shouldRedact ? redactString(message) : message,
    }
  })
}

/**
 * Prunes network HAR entries by removing binary content. Bodies are passed
 * through untouched — body truncation now lives in
 * `formatter-network-sections.ts` (see `MAX_BODY_LENGTH`) as a single layer
 * that is JSON-aware.
 * @param entries - Array of HAR entries to prune
 * @param options - Options to control redaction behavior
 * @param options.redactSensitiveInfo - Whether to redact sensitive data (default: true)
 * @param options.truncateResponseBodies - Deprecated: no-op. Body truncation
 *   moved to formatter-network-sections.ts. Kept in the signature for
 *   backward compatibility with callers that still pass it.
 * @returns New array with pruned entries (original not mutated)
 */
export function pruneNetwork(
  entries: HAREntry[],
  options?: { redactSensitiveInfo?: boolean; truncateResponseBodies?: boolean }
): HAREntry[] {
  const shouldRedact = options?.redactSensitiveInfo !== false

  return entries.map((entry) => {
    const pruned = { ...entry }

    // Remove binary response content
    if (isBinaryContent(entry.response?.content)) {
      pruned.response = {
        ...entry.response,
        content: {
          size: entry.response.content?.size || 0,
          mimeType: entry.response.content?.mimeType || 'unknown',
          text: '[Binary content removed]',
        },
      }
    } else {
      // Pass text content through unchanged; the formatter applies the
      // JSON-aware single-layer truncation at MAX_BODY_LENGTH.
      pruned.response = {
        ...entry.response,
        content: {
          ...entry.response?.content,
          text: entry.response?.content?.text ?? '',
        },
      }
    }

    // Request body is passed through unchanged for the same reason.
    if (pruned.request?.postData?.text) {
      pruned.request = {
        ...pruned.request,
        postData: {
          ...pruned.request.postData,
          text: pruned.request.postData.text,
        },
      }
    }

    return shouldRedact ? redactHAREntry(pruned) : pruned
  })
}

/**
 * Checks if a console message contains failure indicators
 * @param message - Console message text to analyze
 * @returns True if message appears to contain an error/failure signal
 */
function isFailureLike(message: string): boolean {
  const lower = message.toLowerCase()
  return FAILURE_KEYWORDS.some((keyword) => lower.includes(keyword))
}

/**
 * Checks if content is binary based on MIME type
 * @param content - HAR content object to check
 * @returns True if content is binary, false otherwise
 */
function isBinaryContent(content?: HARContent): boolean {
  if (!content?.mimeType) return false
  return PRUNE_CONFIG.BINARY_MIME_TYPES.some((type) => content.mimeType?.startsWith(type))
}

/**
 * Truncates a string to maximum length, adding indicator if truncated
 * @param str - String to truncate
 * @param maxLength - Maximum length before truncation
 * @param isFailure - Whether this is a failure message (preserves more context)
 * @returns Truncated string or original if within limit
 */
function truncate(str: string | undefined, maxLength: number, isFailure = false): string {
  if (!str) return ''
  if (str.length <= maxLength) return str

  // For failure messages, preserve more context
  if (isFailure) {
    // Keep first 200 chars, or 40% of message, whichever is smaller
    // But never go below 100 chars minimum
    const preserveLength = Math.min(200, Math.max(100, Math.floor(str.length * 0.4)))
    return `${str.substring(0, preserveLength)}... [truncated]`
  }

  // Standard truncation for non-failure messages
  return `${str.substring(0, maxLength)}... [truncated]`
}
