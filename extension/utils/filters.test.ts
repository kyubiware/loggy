/**
 * Test suite for filter utilities (filterConsole and filterNetwork)
 */

import { describe, expect, test } from 'vitest'
import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'
import {
  extractPathname,
  filterByRoutes,
  filterConsole,
  filterNetwork,
  getRouteOptions,
} from './filters'

// Mock data for tests
const mockConsoleLogs: ConsoleMessage[] = [
  {
    timestamp: '2024-01-15T10:30:00Z',
    level: 'error',
    message: 'API request failed with status 500',
  },
  {
    timestamp: '2024-01-15T10:30:01Z',
    level: 'warn',
    message: 'Cache miss for user data',
  },
  {
    timestamp: '2024-01-15T10:30:02Z',
    level: 'log',
    message: 'User logged in successfully',
  },
  {
    timestamp: '2024-01-15T10:30:03Z',
    level: 'info',
    message: 'API response received in 150ms',
  },
  {
    timestamp: '2024-01-15T10:30:04Z',
    level: 'debug',
    message: 'Fetching data from external API',
  },
]

const mockNetworkEntries: HAREntry[] = [
  {
    startedDateTime: '2024-01-15T10:30:00Z',
    request: {
      url: 'https://api.example.com/v1/users',
      method: 'GET',
    },
    response: {
      status: 200,
      statusText: 'OK',
      content: { mimeType: 'application/json' },
    },
  },
  {
    startedDateTime: '2024-01-15T10:30:01Z',
    request: {
      url: 'https://cdn.example.com/images/logo.png',
      method: 'GET',
    },
    response: {
      status: 200,
      statusText: 'OK',
      content: { mimeType: 'image/png' },
    },
  },
  {
    startedDateTime: '2024-01-15T10:30:02Z',
    request: {
      url: 'https://api.example.com/v1/posts',
      method: 'POST',
    },
    response: {
      status: 201,
      statusText: 'Created',
      content: { mimeType: 'application/json' },
    },
  },
  {
    startedDateTime: '2024-01-15T10:30:03Z',
    request: {
      url: 'https://cdn.example.com/js/app.js',
      method: 'GET',
    },
    response: {
      status: 200,
      statusText: 'OK',
      content: { mimeType: 'text/javascript' },
    },
  },
  {
    startedDateTime: '2024-01-15T10:30:04Z',
    request: {
      url: 'https://api.example.com/v1/auth',
      method: 'POST',
    },
    response: {
      status: 401,
      statusText: 'Unauthorized',
      content: { mimeType: 'application/json' },
    },
  },
]

describe('filterConsole', () => {
  test('should return all logs when pattern is empty', () => {
    const result = filterConsole(mockConsoleLogs, '')
    expect(result).toEqual(mockConsoleLogs)
    expect(result).toHaveLength(5)
  })

  test('should return all logs when pattern contains only whitespace', () => {
    const result = filterConsole(mockConsoleLogs, '   ')
    expect(result).toEqual(mockConsoleLogs)
    expect(result).toHaveLength(5)
  })

  test('should filter logs by valid regex pattern matching message', () => {
    const result = filterConsole(mockConsoleLogs, 'API')
    expect(result).toHaveLength(3)
    expect(result.every((log) => log.message.includes('API'))).toBe(true)
  })

  test('should filter logs by valid regex pattern with alternation (|)', () => {
    const result = filterConsole(mockConsoleLogs, 'error|warn')
    expect(result).toHaveLength(2)
    expect(result.map((log) => log.level)).toEqual(expect.arrayContaining(['error', 'warn']))
  })

  test('should filter logs by valid regex pattern matching level', () => {
    const result = filterConsole(mockConsoleLogs, 'error')
    expect(result).toHaveLength(1)
    expect(result[0].level).toBe('error')
  })

  test('should perform case-insensitive matching', () => {
    const result = filterConsole(mockConsoleLogs, 'api')
    expect(result).toHaveLength(3)
  })

  test('should handle wildcard patterns (.*)', () => {
    const result = filterConsole(mockConsoleLogs, '.*API.*')
    expect(result).toHaveLength(3)
  })

  test('should fall back to string match when regex is invalid', () => {
    const result = filterConsole(mockConsoleLogs, '(unclosed')
    expect(result).toHaveLength(0)
  })

  test('should return empty array when nothing matches', () => {
    const result = filterConsole(mockConsoleLogs, 'nonexistent')
    expect(result).toHaveLength(0)
  })

  test('should not mutate input array', () => {
    const originalLogs = [...mockConsoleLogs]
    filterConsole(mockConsoleLogs, 'error')
    expect(mockConsoleLogs).toEqual(originalLogs)
  })

  test('should handle multiple word pattern with regex', () => {
    const result = filterConsole(mockConsoleLogs, 'request|response')
    expect(result).toHaveLength(2)
  })
})

describe('filterNetwork', () => {
  test('should return all entries when pattern is empty', () => {
    const result = filterNetwork(mockNetworkEntries, '')
    expect(result).toEqual(mockNetworkEntries)
    expect(result).toHaveLength(5)
  })

  test('should return all entries when pattern contains only whitespace', () => {
    const result = filterNetwork(mockNetworkEntries, '   ')
    expect(result).toEqual(mockNetworkEntries)
    expect(result).toHaveLength(5)
  })

  test('should filter by include pattern on URL', () => {
    const result = filterNetwork(mockNetworkEntries, 'api')
    expect(result).toHaveLength(3)
    expect(result.every((entry) => entry.request.url.includes('api'))).toBe(true)
  })

  test('should filter by multiple include patterns', () => {
    const result = filterNetwork(mockNetworkEntries, 'api v1')
    expect(result).toHaveLength(3)
    expect(
      result.every((entry) => entry.request.url.includes('api') && entry.request.url.includes('v1'))
    ).toBe(true)
  })

  test('should filter by exclude pattern with - prefix', () => {
    const result = filterNetwork(mockNetworkEntries, '-image')
    expect(result).toHaveLength(4)
    expect(result.every((entry) => !entry.response.content?.mimeType?.includes('image'))).toBe(true)
  })

  test('should filter by multiple exclude patterns', () => {
    const result = filterNetwork(mockNetworkEntries, '-cdn')
    expect(result).toHaveLength(3)
    expect(result.every((entry) => !entry.request.url.includes('cdn'))).toBe(true)
  })

  test('should handle mixed include and exclude patterns', () => {
    const result = filterNetwork(mockNetworkEntries, 'api -cdn')
    expect(result).toHaveLength(3)
    expect(
      result.every(
        (entry) => entry.request.url.includes('api') && !entry.request.url.includes('cdn')
      )
    ).toBe(true)
  })

  test('should perform case-insensitive matching', () => {
    const result = filterNetwork(mockNetworkEntries, 'API')
    expect(result).toHaveLength(3)
  })

  test('should match against HTTP method', () => {
    const result = filterNetwork(mockNetworkEntries, 'POST')
    expect(result).toHaveLength(2)
    expect(result.every((entry) => entry.request.method === 'POST')).toBe(true)
  })

  test('should match against status code', () => {
    const result = filterNetwork(mockNetworkEntries, '200')
    expect(result).toHaveLength(3)
    expect(result.every((entry) => entry.response.status === 200)).toBe(true)
  })

  test('should match against MIME type', () => {
    const result = filterNetwork(mockNetworkEntries, 'json')
    expect(result).toHaveLength(3)
    expect(result.every((entry) => entry.response.content?.mimeType?.includes('json'))).toBe(true)
  })

  test('should return empty array when exclude patterns match all entries', () => {
    const result = filterNetwork(mockNetworkEntries, '-api -cdn')
    expect(result).toHaveLength(0)
  })

  test('should not mutate input array', () => {
    const originalEntries = [...mockNetworkEntries]
    filterNetwork(mockNetworkEntries, 'api')
    expect(mockNetworkEntries).toEqual(originalEntries)
  })

  test('should handle only exclude patterns (no includes)', () => {
    const result = filterNetwork(mockNetworkEntries, '-cdn')
    expect(result).toHaveLength(3)
  })

  test('should handle entries with missing optional fields', () => {
    const entriesWithMissing: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/test', method: 'GET' },
        response: { status: 200, statusText: 'OK' },
      },
    ]
    const result = filterNetwork(entriesWithMissing, 'test')
    expect(result).toHaveLength(1)
  })

  test('should treat pattern with leading/trailing spaces correctly', () => {
    const result = filterNetwork(mockNetworkEntries, '  api  ')
    expect(result).toHaveLength(3)
  })
})

describe('extractPathname', () => {
  test('should extract pathname from URL with query params', () => {
    const result = extractPathname('https://api.example.com/users?sort=asc#top')
    expect(result).toBe('/users')
  })

  test('should extract pathname from URL with hash only', () => {
    const result = extractPathname('https://api.example.com/users#section')
    expect(result).toBe('/users')
  })

  test('should normalize trailing slash (not root)', () => {
    const result = extractPathname('https://api.example.com/users/')
    expect(result).toBe('/users')
  })

  test('should preserve root path as /', () => {
    const result = extractPathname('https://api.example.com/')
    expect(result).toBe('/')
  })

  test('should handle URL without path', () => {
    const result = extractPathname('https://api.example.com')
    expect(result).toBe('/')
  })
})

describe('getRouteOptions', () => {
  const multiOriginEntries: HAREntry[] = [
    {
      startedDateTime: '2024-01-15T10:30:00Z',
      request: {
        url: 'https://api.example.com/v1/users',
        method: 'GET',
      },
      response: {
        status: 200,
        statusText: 'OK',
        content: { mimeType: 'application/json' },
      },
    },
    {
      startedDateTime: '2024-01-15T10:30:01Z',
      request: {
        url: 'https://cdn.example.com/v1/users',
        method: 'GET',
      },
      response: {
        status: 200,
        statusText: 'OK',
        content: { mimeType: 'application/json' },
      },
    },
    {
      startedDateTime: '2024-01-15T10:30:02Z',
      request: {
        url: 'https://api.example.com/v1/posts',
        method: 'GET',
      },
      response: {
        status: 200,
        statusText: 'OK',
        content: { mimeType: 'application/json' },
      },
    },
    {
      startedDateTime: '2024-01-15T10:30:03Z',
      request: {
        url: 'https://api.example.com/v1/auth',
        method: 'POST',
      },
      response: {
        status: 200,
        statusText: 'OK',
        content: { mimeType: 'application/json' },
      },
    },
  ]

  test('should deduplicate same pathnames from different origins', () => {
    const options = getRouteOptions(multiOriginEntries)
    expect(options.includes('/v1/users')).toBe(true)
    expect(options.length).toBe(3) // Should deduplicate /v1/users
  })

  test('should return unique pathnames sorted alphabetically', () => {
    const options = getRouteOptions(multiOriginEntries)
    expect(options).toEqual(['/v1/auth', '/v1/posts', '/v1/users'])
  })

  test('should handle empty entries array', () => {
    const options = getRouteOptions([])
    expect(options).toEqual([])
  })
})

describe('filterByRoutes', () => {
  const routeTestEntries: HAREntry[] = [
    {
      startedDateTime: '2024-01-15T10:30:00Z',
      request: {
        url: 'https://api.example.com/v1/users',
        method: 'GET',
      },
      response: {
        status: 200,
        statusText: 'OK',
        content: { mimeType: 'application/json' },
      },
    },
    {
      startedDateTime: '2024-01-15T10:30:01Z',
      request: {
        url: 'https://api.example.com/v1/posts',
        method: 'GET',
      },
      response: {
        status: 200,
        statusText: 'OK',
        content: { mimeType: 'application/json' },
      },
    },
    {
      startedDateTime: '2024-01-15T10:30:02Z',
      request: {
        url: 'https://api.example.com/v1/auth',
        method: 'POST',
      },
      response: {
        status: 200,
        statusText: 'OK',
        content: { mimeType: 'application/json' },
      },
    },
  ]

  test('should return all entries when selectedRoutes is empty (passthrough)', () => {
    const result = filterByRoutes(routeTestEntries, [])
    expect(result.length).toBe(3)
  })

  test('should filter by single selected route', () => {
    const result = filterByRoutes(routeTestEntries, ['/v1/users'])
    expect(result.every((entry: HAREntry) => entry.request.url.includes('/v1/users'))).toBe(true)
    expect(result.length).toBe(1)
  })

  test('should use OR semantics for multiple selected routes', () => {
    const result = filterByRoutes(routeTestEntries, ['/v1/users', '/v1/posts'])
    expect(result.length).toBe(2)
  })

  test('should match entries from any origin with same pathname', () => {
    const crossOriginEntries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://api.example.com/v1/users',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'application/json' },
        },
      },
      {
        startedDateTime: '2024-01-15T10:30:01Z',
        request: {
          url: 'https://cdn.example.com/v1/users',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'application/json' },
        },
      },
    ]

    const result = filterByRoutes(crossOriginEntries, ['/v1/users'])
    expect(result.length).toBe(2)
  })

  test('should return empty array when no routes match', () => {
    const result = filterByRoutes(routeTestEntries, ['/v1/nonexistent'])
    expect(result.length).toBe(0)
  })

  test('should not mutate input array', () => {
    const originalEntries = [...routeTestEntries]
    filterByRoutes(routeTestEntries, ['/v1/users'])
    expect(routeTestEntries).toEqual(originalEntries)
  })
})
