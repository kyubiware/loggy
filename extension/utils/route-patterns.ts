/**
 * Route pattern normalization and grouping.
 *
 * Pure helpers used by the popup and panel RoutesList components to collapse
 * concrete pathnames containing dynamic segments (UUIDs, numeric IDs) into a
 * single representative pattern. The collapse is purely visual — the export
 * filter pipeline (utils/filters.ts → filterByRoutes) still operates on
 * concrete pathnames via exact string match.
 */

export interface RouteGroup {
  /** Normalized pattern, e.g. '/api/text-sessions/:id' or '/api/articles' */
  pattern: string
  /** Concrete routes that collapse into this pattern, sorted alphabetically */
  routes: string[]
  /** true if pattern contains any :id placeholder */
  hasDynamicSegments: boolean
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUMERIC_RE = /^\d+$/
const ID_PLACEHOLDER = ':id'

/**
 * Returns true if a single URL path segment should be treated as a dynamic ID
 * and replaced with the ':id' placeholder. Only UUIDs and pure numeric strings
 * match — hex hashes shorter than UUID, words, and other shapes are left alone
 * to avoid false positives.
 */
function isDynamicSegment(segment: string): boolean {
  return UUID_RE.test(segment) || NUMERIC_RE.test(segment)
}

/**
 * Replace UUID and numeric path segments with the ':id' placeholder while
 * leaving every other segment untouched. Mirrors the contract of
 * utils/filters.ts → extractPathname for the degenerate inputs:
 *   - ''   → '/'
 *   - '/'  → '/'
 *
 * Examples:
 *   '/api/text-sessions/b38b1ef5-035c-46bb-a855-dd93386b3a8e' → '/api/text-sessions/:id'
 *   '/api/users/123'                                            → '/api/users/:id'
 *   '/api/users/123/posts/456'                                  → '/api/users/:id/posts/:id'
 *   '/api/articles'                                             → '/api/articles'
 *   '/'                                                         → '/'
 */
export function normalizeRoutePattern(pathname: string): string {
  if (!pathname) return '/'

  const segments = pathname.split('/')
  const normalized = segments.map((segment) =>
    segment.length > 0 && isDynamicSegment(segment) ? ID_PLACEHOLDER : segment
  )

  const result = normalized.join('/')
  return result.length > 0 ? result : '/'
}

/**
 * Group concrete pathnames by their normalized pattern.
 *
 * - Groups are returned sorted alphabetically by `pattern`.
 * - Within each group, `routes` is sorted alphabetically.
 * - Groups for non-dynamic patterns contain exactly one route, with
 *   `hasDynamicSegments: false`.
 * - Groups for dynamic patterns contain every concrete route that
 *   normalizes to the same pattern, with `hasDynamicSegments: true`.
 *
 * Order of the input array does not matter.
 */
export function groupRoutesByPattern(routes: string[]): RouteGroup[] {
  if (routes.length === 0) return []

  const groupsByPattern = new Map<string, string[]>()

  for (const route of routes) {
    const pattern = normalizeRoutePattern(route)
    const existing = groupsByPattern.get(pattern)
    if (existing) {
      existing.push(route)
    } else {
      groupsByPattern.set(pattern, [route])
    }
  }

  const patterns = [...groupsByPattern.keys()].sort()
  return patterns.map((pattern) => {
    const groupedRoutes = (groupsByPattern.get(pattern) ?? []).sort()
    return {
      pattern,
      routes: groupedRoutes,
      hasDynamicSegments: pattern.includes(ID_PLACEHOLDER),
    }
  })
}
