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
