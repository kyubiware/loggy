/**
 * Shared text helpers for Markdown formatting.
 */

/**
 * Converts bytes to human-readable format
 * @param bytes - Number of bytes to format
 * @returns Formatted string with appropriate unit (B, KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * Truncates long strings with indicator
 * @param str - String to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string with indicator if truncated
 */
export function truncate(str: string, maxLength: number): string {
  if (!str) return ''
  if (str.length <= maxLength) return str
  return `${str.substring(0, maxLength)}... [truncated]`
}

/**
 * Escapes special Markdown characters for safe rendering
 * @param text - Text to escape
 * @returns Escaped text safe for Markdown
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/`/g, '\\`').replace(/\*/g, '\\*')
}
