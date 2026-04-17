/**
 * Filter utilities for Console and Network data in Loggy Chrome Extension
 * Provides pattern matching and regex-based filtering
 */

import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'

/**
 * Filter console logs by pattern (supports regex)
 * Falls back to simple string match if regex is invalid
 *
 * @param logs - Array of console messages to filter
 * @param pattern - Filter pattern (regex or string)
 * @returns Filtered array of console messages
 */
export function filterConsole(logs: ConsoleMessage[], pattern: string): ConsoleMessage[] {
  if (!pattern.trim()) return logs

  try {
    const regex = new RegExp(pattern, 'i')
    return logs.filter((log) => regex.test(log.message) || regex.test(log.level))
  } catch (_e) {
    // Invalid regex, fall back to simple string match
    const lowerPattern = pattern.toLowerCase()
    return logs.filter(
      (log) =>
        log.message.toLowerCase().includes(lowerPattern) ||
        log.level.toLowerCase().includes(lowerPattern)
    )
  }
}

/**
 * Filter network entries by include/exclude patterns
 * Patterns are space-separated:
 * - Prefix with '-' for exclude (e.g., -image)
 * - No prefix for include (e.g., api)
 *
 * @param entries - Array of HAR entries to filter
 * @param pattern - Space-separated include/exclude patterns
 * @returns Filtered array of HAR entries
 */
export function filterNetwork(entries: HAREntry[], pattern: string): HAREntry[] {
  if (!pattern.trim()) return entries

  const patterns = pattern.split(/\s+/).filter((p) => p)
  const includePatterns: string[] = []
  const excludePatterns: string[] = []

  patterns.forEach((p) => {
    if (p.startsWith('-')) {
      excludePatterns.push(p.slice(1).toLowerCase())
    } else {
      includePatterns.push(p.toLowerCase())
    }
  })

  return entries.filter((entry) => {
    const url = entry.request?.url?.toLowerCase() || ''
    const method = entry.request?.method?.toLowerCase() || ''
    const status = String(entry.response?.status || '')
    const mimeType = entry.response?.content?.mimeType?.toLowerCase() || ''

    const text = `${url} ${method} ${status} ${mimeType}`

    // Check excludes first
    if (excludePatterns.some((p) => text.includes(p))) {
      return false
    }

    // Check includes (if any specified)
    if (includePatterns.length > 0) {
      return includePatterns.some((p) => text.includes(p))
    }

    return true
  })
}

/**
 * Extract pathname from URL with query/hash removal and trailing-slash normalization
 *
 * @param url - Full URL string
 * @returns Normalized pathname (e.g., '/users' from 'https://api.com/users?sort=asc#top')
 */
export function extractPathname(url: string): string {
  if (!url) return '/'

  try {
    const urlObj = new URL(url)
    let pathname = urlObj.pathname

    // Normalize trailing slash: remove if not root
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1)
    }

    return pathname || '/'
  } catch {
    // Invalid URL, try basic parsing
    const match = url.match(/^[^?#]+/)
    if (!match) return '/'

    const path = match[0].replace(/^https?:\/\/[^/]+/, '') || '/'
    let normalizedPath = path

    // Normalize trailing slash: remove if not root
    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1)
    }

    return normalizedPath || '/'
  }
}

/**
 * Get unique sorted pathname options from HAR entries
 *
 * @param entries - Array of HAR entries to extract routes from
 * @returns Array of unique pathnames sorted alphabetically
 */
export function getRouteOptions(entries: HAREntry[]): string[] {
  if (!entries || entries.length === 0) return []

  const pathnames = new Set<string>()

  for (const entry of entries) {
    const url = entry.request?.url
    if (url) {
      const pathname = extractPathname(url)
      pathnames.add(pathname)
    }
  }

  return Array.from(pathnames).sort()
}

/**
 * Filter HAR entries by selected routes (OR semantics)
 *
 * @param entries - Array of HAR entries to filter
 * @param selectedRoutes - Array of route pathnames to include (empty = passthrough)
 * @returns Filtered array of HAR entries matching selected routes
 */
export function filterByRoutes(entries: HAREntry[], selectedRoutes: string[]): HAREntry[] {
  // Passthrough: no routes selected means return all entries
  if (!selectedRoutes || selectedRoutes.length === 0) {
    return entries
  }

  // Filter by pathname match (OR semantics)
  return entries.filter((entry) => {
    const url = entry.request?.url
    if (!url) return false

    const pathname = extractPathname(url)
    return selectedRoutes.includes(pathname)
  })
}
