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
