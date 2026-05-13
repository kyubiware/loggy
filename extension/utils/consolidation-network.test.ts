/**
 * Tests for utils/consolidation-network.ts
 * Test coverage for consolidateNetworkEntries() with deduplication and diff logic
 */

import { describe, expect, test } from 'vitest'
import type { HAREntry } from '../types/har'
import { consolidateNetworkEntries } from './consolidation-network'

function makeEntry(overrides: {
  method?: string
  url?: string
  status?: number
  requestBody?: string
  responseBody?: string
  timestamp?: string
}): HAREntry {
  return {
    startedDateTime: overrides.timestamp ?? '2024-01-01T00:00:00.000Z',
    request: {
      method: overrides.method ?? 'GET',
      url: overrides.url ?? 'https://api.example.com/v1/users',
      postData: overrides.requestBody !== undefined ? { text: overrides.requestBody } : undefined,
    },
    response: {
      status: overrides.status ?? 200,
      statusText: 'OK',
      content:
        overrides.responseBody !== undefined
          ? { text: overrides.responseBody, mimeType: 'application/json' }
          : undefined,
    },
    time: 100,
  }
}

describe('consolidateNetworkEntries', () => {
  describe('deduplication grouping', () => {
    test('empty array returns empty array', () => {
      const result = consolidateNetworkEntries([])
      expect(result).toEqual([])
    })

    test('single entry returns one group with count 1 and identicalResponses true', () => {
      const entry = makeEntry({})
      const result = consolidateNetworkEntries([entry])

      expect(result).toHaveLength(1)
      expect(result[0].count).toBe(1)
      expect(result[0].identicalResponses).toBe(true)
      expect(result[0].method).toBe('GET')
      expect(result[0].url).toBe('https://api.example.com/v1/users')
    })

    test('two identical entries (same method, url, no body) group into one with count 2', () => {
      const entries = [
        makeEntry({ timestamp: '2024-01-01T00:00:00.000Z' }),
        makeEntry({ timestamp: '2024-01-01T00:00:01.000Z' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result).toHaveLength(1)
      expect(result[0].count).toBe(2)
      expect(result[0].key).toBe('GET::https://api.example.com/v1/users::')
    })

    test('two entries with different methods create two separate groups', () => {
      const entries = [makeEntry({ method: 'GET' }), makeEntry({ method: 'POST' })]
      const result = consolidateNetworkEntries(entries)

      expect(result).toHaveLength(2)
      expect(result[0].count).toBe(1)
      expect(result[1].count).toBe(1)
      expect(result.some((g) => g.method === 'GET')).toBe(true)
      expect(result.some((g) => g.method === 'POST')).toBe(true)
    })

    test('two entries with different URLs create two separate groups', () => {
      const entries = [
        makeEntry({ url: 'https://api.example.com/v1/users' }),
        makeEntry({ url: 'https://api.example.com/v1/posts' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result).toHaveLength(2)
      expect(result[0].count).toBe(1)
      expect(result[1].count).toBe(1)
    })

    test('two entries same URL but different request body create two separate groups', () => {
      const entries = [
        makeEntry({ requestBody: '{"id":1}' }),
        makeEntry({ requestBody: '{"id":2}' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result).toHaveLength(2)
      expect(result[0].count).toBe(1)
      expect(result[1].count).toBe(1)
    })

    test('three entries with same key group into one with count 3 and three timestamps', () => {
      const entries = [
        makeEntry({ timestamp: '2024-01-01T00:00:00.000Z' }),
        makeEntry({ timestamp: '2024-01-01T00:00:01.000Z' }),
        makeEntry({ timestamp: '2024-01-01T00:00:02.000Z' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result).toHaveLength(1)
      expect(result[0].count).toBe(3)
      expect(result[0].timestamps).toHaveLength(3)
      expect(result[0].timestamps).toEqual([
        '2024-01-01T00:00:00.000Z',
        '2024-01-01T00:00:01.000Z',
        '2024-01-01T00:00:02.000Z',
      ])
    })

    test('mixed entries produce correct number of groups', () => {
      const entries = [
        makeEntry({ method: 'GET', url: 'https://api.example.com/a' }),
        makeEntry({ method: 'GET', url: 'https://api.example.com/a' }),
        makeEntry({ method: 'POST', url: 'https://api.example.com/a' }),
        makeEntry({ method: 'GET', url: 'https://api.example.com/b' }),
        makeEntry({ method: 'GET', url: 'https://api.example.com/a' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result).toHaveLength(3)
      const groupA = result.find((g) => g.method === 'GET' && g.url === 'https://api.example.com/a')
      const groupB = result.find(
        (g) => g.method === 'POST' && g.url === 'https://api.example.com/a'
      )
      const groupC = result.find((g) => g.method === 'GET' && g.url === 'https://api.example.com/b')

      expect(groupA?.count).toBe(3)
      expect(groupB?.count).toBe(1)
      expect(groupC?.count).toBe(1)
    })

    test('preserves insertion order: first entry in group is the first that appeared', () => {
      const entries = [
        makeEntry({ timestamp: '2024-01-01T00:00:05.000Z' }),
        makeEntry({ timestamp: '2024-01-01T00:00:01.000Z' }),
        makeEntry({ timestamp: '2024-01-01T00:00:03.000Z' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result).toHaveLength(1)
      expect(result[0].entries[0].startedDateTime).toBe('2024-01-01T00:00:05.000Z')
      expect(result[0].entries[1].startedDateTime).toBe('2024-01-01T00:00:01.000Z')
      expect(result[0].entries[2].startedDateTime).toBe('2024-01-01T00:00:03.000Z')
    })
  })

  describe('response body identity', () => {
    test('all identical response bodies → identicalResponses true and bodyDiffs all haveDiff false', () => {
      const entries = [
        makeEntry({ responseBody: '{"id":1}' }),
        makeEntry({ responseBody: '{"id":1}' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].identicalResponses).toBe(true)
      expect(result[0].bodyDiffs.every((d) => d.hasDiff === false)).toBe(true)
      expect(result[0].bodyDiffs.every((d) => d.diffLines === undefined)).toBe(true)
    })

    test('different response bodies → identicalResponses false and bodyDiffs show diffs', () => {
      const entries = [
        makeEntry({ responseBody: '{"id":1}' }),
        makeEntry({ responseBody: '{"id":2}' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].identicalResponses).toBe(false)
      expect(result[0].bodyDiffs[0].hasDiff).toBe(false)
      expect(result[0].bodyDiffs[1].hasDiff).toBe(true)
      expect(result[0].bodyDiffs[1].diffLines).toBeDefined()
      expect(result[0].bodyDiffs[1].diffLines?.length).toBeGreaterThan(0)
    })

    test('no response bodies (undefined) → identicalResponses is true', () => {
      const entries = [
        makeEntry({ responseBody: undefined }),
        makeEntry({ responseBody: undefined }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].identicalResponses).toBe(true)
      expect(result[0].bodyDiffs.every((d) => d.hasDiff === false)).toBe(true)
    })

    test('first undefined, second has content → identicalResponses is false', () => {
      const entries = [
        makeEntry({ responseBody: undefined }),
        makeEntry({ responseBody: '{"id":1}' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].identicalResponses).toBe(false)
    })

    test('empty string vs undefined → identicalResponses is false', () => {
      const entries = [makeEntry({ responseBody: '' }), makeEntry({ responseBody: undefined })]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].identicalResponses).toBe(false)
    })
  })

  describe('body diffs', () => {
    test('identical bodies → diffLines is undefined for all entries', () => {
      const entries = [
        makeEntry({ responseBody: 'line1\nline2' }),
        makeEntry({ responseBody: 'line1\nline2' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].bodyDiffs[0].diffLines).toBeUndefined()
      expect(result[0].bodyDiffs[1].diffLines).toBeUndefined()
    })

    test('single line change → diffLines shows - old / + new', () => {
      const entries = [
        makeEntry({ responseBody: 'old line' }),
        makeEntry({ responseBody: 'new line' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].bodyDiffs[1].diffLines).toEqual(['- old line', '+ new line'])
    })

    test('added line → diffLines shows + new line', () => {
      const entries = [
        makeEntry({ responseBody: 'line1' }),
        makeEntry({ responseBody: 'line1\nline2' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].bodyDiffs[1].diffLines).toEqual(['+ line2'])
    })

    test('removed line → diffLines shows - removed line', () => {
      const entries = [
        makeEntry({ responseBody: 'line1\nline2' }),
        makeEntry({ responseBody: 'line1' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].bodyDiffs[1].diffLines).toEqual(['- line2'])
    })

    test('multiple lines changed → all diffs captured', () => {
      const entries = [
        makeEntry({ responseBody: 'a\nb\nc' }),
        makeEntry({ responseBody: 'x\ny\nz' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].bodyDiffs[1].diffLines).toEqual(['- a', '+ x', '- b', '+ y', '- c', '+ z'])
    })

    test('baseline has more lines → removed lines shown', () => {
      const entries = [
        makeEntry({ responseBody: 'line1\nline2\nline3' }),
        makeEntry({ responseBody: 'line1' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].bodyDiffs[1].diffLines).toEqual(['- line2', '- line3'])
    })

    test('current has more lines → added lines shown', () => {
      const entries = [
        makeEntry({ responseBody: 'line1' }),
        makeEntry({ responseBody: 'line1\nline2\nline3' }),
      ]
      const result = consolidateNetworkEntries(entries)

      expect(result[0].bodyDiffs[1].diffLines).toEqual(['+ line2', '+ line3'])
    })
  })

  describe('edge cases', () => {
    test('entry with postData undefined → dedup key uses empty string for body', () => {
      const entry = makeEntry({})
      expect(entry.request.postData).toBeUndefined()

      const result = consolidateNetworkEntries([entry])
      expect(result[0].key).toBe('GET::https://api.example.com/v1/users::')
      expect(result[0].requestBody).toBeUndefined()
    })

    test('entry with postData.text as empty string → dedup key uses empty string', () => {
      const entry = makeEntry({ requestBody: '' })
      const result = consolidateNetworkEntries([entry])

      expect(result[0].key).toBe('GET::https://api.example.com/v1/users::')
      expect(result[0].requestBody).toBe('')
    })

    test('entries with undefined postData and empty string postData group together', () => {
      const entries = [makeEntry({ requestBody: undefined }), makeEntry({ requestBody: '' })]
      const result = consolidateNetworkEntries(entries)

      expect(result).toHaveLength(1)
      expect(result[0].count).toBe(2)
    })

    test('very long URL still works as dedup key', () => {
      const longUrl = `https://api.example.com/${'a'.repeat(1000)}`
      const entry = makeEntry({ url: longUrl })
      const result = consolidateNetworkEntries([entry])

      expect(result).toHaveLength(1)
      expect(result[0].url).toBe(longUrl)
      expect(result[0].key).toContain(longUrl)
    })

    test('special characters in URL still deduplicate correctly', () => {
      const url = 'https://api.example.com/v1/users?id=1&name=test+value'
      const entries = [makeEntry({ url }), makeEntry({ url })]
      const result = consolidateNetworkEntries(entries)

      expect(result).toHaveLength(1)
      expect(result[0].count).toBe(2)
      expect(result[0].url).toBe(url)
    })
  })
})
