import { describe, expect, it } from 'vitest'
import type { HAREntry } from '../types/har'
import { createInitialState } from '../types/state'
import { getFilteredPanelData } from './filtered-data'

const routeTestEntries: HAREntry[] = [
  {
    startedDateTime: '2024-01-15T10:30:00Z',
    request: { url: 'https://api.example.com/v1/users', method: 'GET' },
    response: { status: 200, statusText: 'OK', content: { mimeType: 'application/json' } },
  },
  {
    startedDateTime: '2024-01-15T10:30:01Z',
    request: { url: 'https://api.example.com/v1/posts', method: 'GET' },
    response: { status: 200, statusText: 'OK', content: { mimeType: 'application/json' } },
  },
  {
    startedDateTime: '2024-01-15T10:30:02Z',
    request: { url: 'https://api.example.com/v1/auth', method: 'POST' },
    response: { status: 200, statusText: 'OK', content: { mimeType: 'application/json' } },
  },
]

function buildState(overrides: Partial<ReturnType<typeof createInitialState>> = {}) {
  return { ...createInitialState(), ...overrides }
}

describe('getFilteredPanelData — routesFilterEnabled', () => {
  describe('routesFilterEnabled=false (initial session state)', () => {
    it('passes through all network entries when selectedRoutes is empty', () => {
      const state = buildState({
        networkEntries: routeTestEntries,
        selectedRoutes: [],
        routesFilterEnabled: false,
      })

      const result = getFilteredPanelData(state)

      expect(result.networkEntries).toHaveLength(3)
    })

    it('still applies selectedRoutes filter if routes are selected even when flag is false', () => {
      const state = buildState({
        networkEntries: routeTestEntries,
        selectedRoutes: ['/v1/users'],
        routesFilterEnabled: false,
      })

      const result = getFilteredPanelData(state)

      expect(result.networkEntries).toHaveLength(3)
    })
  })

  describe('routesFilterEnabled=true (user has engaged route filtering)', () => {
    it('excludes ALL network entries when selectedRoutes is empty', () => {
      const state = buildState({
        networkEntries: routeTestEntries,
        selectedRoutes: [],
        routesFilterEnabled: true,
      })

      const result = getFilteredPanelData(state)

      expect(result.networkEntries).toHaveLength(0)
    })

    it('includes only entries matching selectedRoutes', () => {
      const state = buildState({
        networkEntries: routeTestEntries,
        selectedRoutes: ['/v1/users', '/v1/posts'],
        routesFilterEnabled: true,
      })

      const result = getFilteredPanelData(state)

      expect(result.networkEntries).toHaveLength(2)
      expect(
        result.networkEntries.every(
          (e) => e.request.url.includes('/v1/users') || e.request.url.includes('/v1/posts')
        )
      ).toBe(true)
    })

    it('includes all entries when all routes are selected', () => {
      const state = buildState({
        networkEntries: routeTestEntries,
        selectedRoutes: ['/v1/users', '/v1/posts', '/v1/auth'],
        routesFilterEnabled: true,
      })

      const result = getFilteredPanelData(state)

      expect(result.networkEntries).toHaveLength(3)
    })
  })

  it('routeOptions are always derived from text-filtered entries regardless of flag', () => {
    const state = buildState({
      networkEntries: routeTestEntries,
      selectedRoutes: [],
      routesFilterEnabled: true,
    })

    const result = getFilteredPanelData(state)

    expect(result.routeOptions).toEqual(['/v1/auth', '/v1/posts', '/v1/users'])
  })
})
