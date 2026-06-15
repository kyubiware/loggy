/**
 * Test suite for route pattern normalization and grouping helpers.
 */

import { describe, expect, it } from 'vitest'
import { groupRoutesByPattern, normalizeRoutePattern } from './route-patterns'

describe('normalizeRoutePattern', () => {
  it('replaces a UUID segment in the middle of a path with :id', () => {
    expect(normalizeRoutePattern('/api/text-sessions/b38b1ef5-035c-46bb-a855-dd93386b3a8e')).toBe(
      '/api/text-sessions/:id'
    )
  })

  it('replaces a UUID at the start of a path with :id', () => {
    expect(normalizeRoutePattern('/b38b1ef5-035c-46bb-a855-dd93386b3a8e/details')).toBe(
      '/:id/details'
    )
  })

  it('replaces a UUID regardless of letter case', () => {
    expect(normalizeRoutePattern('/api/sessions/B38B1EF5-035C-46BB-A855-DD93386B3A8E')).toBe(
      '/api/sessions/:id'
    )
  })

  it('replaces a pure numeric segment with :id', () => {
    expect(normalizeRoutePattern('/api/users/123')).toBe('/api/users/:id')
  })

  it('replaces multiple numeric IDs in one path', () => {
    expect(normalizeRoutePattern('/api/users/123/posts/456')).toBe('/api/users/:id/posts/:id')
  })

  it('replaces a mix of UUID and numeric segments', () => {
    expect(
      normalizeRoutePattern('/api/users/123/sessions/b38b1ef5-035c-46bb-a855-dd93386b3a8e')
    ).toBe('/api/users/:id/sessions/:id')
  })

  it('leaves a fully static path unchanged', () => {
    expect(normalizeRoutePattern('/api/articles')).toBe('/api/articles')
  })

  it('leaves a static path with multiple segments unchanged', () => {
    expect(normalizeRoutePattern('/api/v1/articles/list')).toBe('/api/v1/articles/list')
  })

  it('does not treat short hex hashes (shorter than UUID) as dynamic', () => {
    expect(normalizeRoutePattern('/api/assets/abc123')).toBe('/api/assets/abc123')
  })

  it('does not treat alphanumeric identifiers as dynamic', () => {
    expect(normalizeRoutePattern('/api/users/user_42a')).toBe('/api/users/user_42a')
  })

  it('preserves the root /', () => {
    expect(normalizeRoutePattern('/')).toBe('/')
  })

  it('returns / for an empty string (matches extractPathname behavior)', () => {
    expect(normalizeRoutePattern('')).toBe('/')
  })

  it('handles a trailing-slash-less root path', () => {
    // extractPathname strips the trailing slash, so this is the realistic input
    expect(normalizeRoutePattern('/')).toBe('/')
  })

  it('handles a deeply nested UUID path', () => {
    expect(
      normalizeRoutePattern(
        '/org/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/team/1eaf8c03-d084-453d-9c66-12ddf4f3b7cb'
      )
    ).toBe('/org/:id/team/:id')
  })
})

describe('groupRoutesByPattern', () => {
  it('returns an empty array for empty input', () => {
    expect(groupRoutesByPattern([])).toEqual([])
  })

  it('keeps each static route as its own group with hasDynamicSegments: false', () => {
    const groups = groupRoutesByPattern(['/api/articles', '/api/users'])
    expect(groups).toEqual([
      { pattern: '/api/articles', routes: ['/api/articles'], hasDynamicSegments: false },
      { pattern: '/api/users', routes: ['/api/users'], hasDynamicSegments: false },
    ])
  })

  it('collapses two UUID routes into a single group', () => {
    const groups = groupRoutesByPattern([
      '/api/text-sessions/b38b1ef5-035c-46bb-a855-dd93386b3a8e',
      '/api/text-sessions/1eaf8c03-d084-453d-9c66-12ddf4f3b7cb',
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.pattern).toBe('/api/text-sessions/:id')
    expect(groups[0]?.routes).toEqual([
      '/api/text-sessions/1eaf8c03-d084-453d-9c66-12ddf4f3b7cb',
      '/api/text-sessions/b38b1ef5-035c-46bb-a855-dd93386b3a8e',
    ])
    expect(groups[0]?.hasDynamicSegments).toBe(true)
  })

  it('collapses mixed UUID and numeric routes that share a pattern', () => {
    const groups = groupRoutesByPattern([
      '/api/users/123',
      '/api/users/b38b1ef5-035c-46bb-a855-dd93386b3a8e',
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.pattern).toBe('/api/users/:id')
    expect(groups[0]?.routes).toEqual([
      '/api/users/123',
      '/api/users/b38b1ef5-035c-46bb-a855-dd93386b3a8e',
    ])
    expect(groups[0]?.hasDynamicSegments).toBe(true)
  })

  it('returns a mix of static and dynamic groups in alphabetical pattern order', () => {
    const groups = groupRoutesByPattern([
      '/api/articles',
      '/api/text-sessions/b38b1ef5-035c-46bb-a855-dd93386b3a8e',
      '/api/text-sessions/1eaf8c03-d084-453d-9c66-12ddf4f3b7cb',
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.pattern).toBe('/api/articles')
    expect(groups[0]?.hasDynamicSegments).toBe(false)
    expect(groups[1]?.pattern).toBe('/api/text-sessions/:id')
    expect(groups[1]?.hasDynamicSegments).toBe(true)
    expect(groups[1]?.routes).toEqual([
      '/api/text-sessions/1eaf8c03-d084-453d-9c66-12ddf4f3b7cb',
      '/api/text-sessions/b38b1ef5-035c-46bb-a855-dd93386b3a8e',
    ])
  })

  it('sorts routes within a dynamic group alphabetically regardless of input order', () => {
    const groups = groupRoutesByPattern(['/api/x/30', '/api/x/10', '/api/x/20'])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.routes).toEqual(['/api/x/10', '/api/x/20', '/api/x/30'])
  })

  it('handles unsorted input array for the canonical example from the spec', () => {
    const groups = groupRoutesByPattern([
      '/api/text-sessions/b38b1ef5-035c-46bb-a855-dd93386b3a8e',
      '/api/text-sessions/1eaf8c03-d084-453d-9c66-12ddf4f3b7cb',
      '/api/articles',
    ])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.pattern).toBe('/api/articles')
    expect(groups[0]?.hasDynamicSegments).toBe(false)
    expect(groups[1]?.pattern).toBe('/api/text-sessions/:id')
    expect(groups[1]?.hasDynamicSegments).toBe(true)
    expect(groups[1]?.routes).toHaveLength(2)
  })

  it('preserves hasDynamicSegments: false for single static route groups', () => {
    const groups = groupRoutesByPattern(['/api/articles'])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.routes).toHaveLength(1)
    expect(groups[0]?.routes[0]).toBe('/api/articles')
    expect(groups[0]?.pattern).toBe(groups[0]?.routes[0])
    expect(groups[0]?.hasDynamicSegments).toBe(false)
  })

  it('keeps the root path in its own group with hasDynamicSegments: false', () => {
    const groups = groupRoutesByPattern(['/', '/api/articles'])
    expect(groups).toEqual([
      { pattern: '/', routes: ['/'], hasDynamicSegments: false },
      { pattern: '/api/articles', routes: ['/api/articles'], hasDynamicSegments: false },
    ])
  })

  it('does not collapse routes with different static prefixes', () => {
    const groups = groupRoutesByPattern(['/api/users/123', '/admin/users/123'])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.pattern).toBe('/admin/users/:id')
    expect(groups[1]?.pattern).toBe('/api/users/:id')
  })

  it('groups multiple dynamic segments within one path under the same pattern', () => {
    const groups = groupRoutesByPattern(['/api/users/123/posts/456', '/api/users/789/posts/101'])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.pattern).toBe('/api/users/:id/posts/:id')
    expect(groups[0]?.hasDynamicSegments).toBe(true)
    expect(groups[0]?.routes).toEqual(['/api/users/123/posts/456', '/api/users/789/posts/101'])
  })
})
