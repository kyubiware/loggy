/**
 * Estimates LLM token count from plain text.
 * Uses a common heuristic of ~4 characters per token for English-heavy text.
 *
 * @param text - Text content to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  if (text.length === 0) {
    return 0
  }

  return Math.ceil(text.length / 4)
}

/**
 * Estimates the token cost of a stored capture entry.
 * Sums the character lengths of all text fields and divides by 4.
 *
 * @param entry - A stored capture entry (console or network)
 * @returns Estimated token count for the entry
 */
export function estimateEntryTokenCount(
  entry:
    | { kind: 'console'; entry: { message: string } }
    | {
        kind: 'network'
        entry: {
          url: string
          method: string
          requestBody?: string
          responseBody?: string
          requestHeaders?: Record<string, string>
          responseHeaders?: Record<string, string>
        }
      }
): number {
  if (entry.kind === 'console') {
    return estimateTokenCount(entry.entry.message)
  }

  const net = entry.entry
  const parts = [
    net.url,
    net.method,
    net.requestBody ?? '',
    net.responseBody ?? '',
    ...Object.values(net.requestHeaders ?? {}),
    ...Object.values(net.responseHeaders ?? {}),
  ]

  return estimateTokenCount(parts.join(''))
}

const TRUNCATION_MARKER = '\n\n> Output truncated to fit token limit.\n'

/**
 * Truncates text so its estimated token count does not exceed maxTokens.
 * Cuts at the last newline before the limit to avoid splitting mid-line.
 * Appends a truncation marker whose size is accounted for in the budget.
 *
 * @param text - Text to potentially truncate
 * @param maxTokens - Maximum allowed estimated tokens (0 = no limit, return as-is)
 * @returns Text within the token budget, or original text if already within limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  if (maxTokens <= 0 || text.length === 0) {
    return text
  }

  const maxChars = maxTokens * 4
  if (text.length <= maxChars) {
    return text
  }

  const markerChars = TRUNCATION_MARKER.length
  const availableChars = maxChars - markerChars

  if (availableChars <= 0) {
    return TRUNCATION_MARKER
  }

  const truncated = text.slice(0, availableChars)
  const lastNewline = truncated.lastIndexOf('\n')

  // Only snap to newline if it's reasonably close (within 20% of available)
  const cutPoint = lastNewline > availableChars * 0.8 ? lastNewline : availableChars

  return text.slice(0, cutPoint) + TRUNCATION_MARKER
}
