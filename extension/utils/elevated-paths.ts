import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'

/**
 * Computes the set of URL path substrings that appear in error/warn console
 * messages. To keep the comparison simple, we extract the path component
 * (no query string) from each network request URL and check whether that
 * path appears as a substring of any error/warn console message string.
 *
 * This means "elevation" is a conservative, easily-auditable heuristic:
 * if the agent logged an error like `HTTP 500 at /api/foo`, all network
 * entries whose URL path `/api/foo` is contained in that message get
 * elevated.
 */
export function computeElevatedUrlPaths(
  consoleLogs: ConsoleMessage[],
  networkEntries: HAREntry[]
): Set<string> {
  const errorMsgs = consoleLogs
    .filter((l) => l.level === 'error' || l.level === 'warn')
    .map((l) => l.message)

  const elevated = new Set<string>()

  for (const entry of networkEntries) {
    try {
      const url = new URL(entry.request.url)
      const path = url.pathname
      for (const msg of errorMsgs) {
        if (msg.includes(path)) {
          elevated.add(path)
          break
        }
      }
    } catch {
      // Malformed URL — skip elevation for this entry
    }
  }

  return elevated
}
