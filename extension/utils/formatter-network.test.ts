/**
 * Tests for utils/formatter-network.ts
 * Test coverage for formatNetworkEntry() with includeResponseBodies flag
 */

import { describe, expect, test } from 'vitest'
import type { HAREntry } from '../types/har'
import type { ConsolidatedNetworkEntry } from './consolidation-network'
import { formatConsolidatedNetworkEntry, formatNetworkEntry } from './formatter-network'
import { formatResponseSection } from './formatter-network-sections'

describe('formatNetworkEntry - includeResponseBodies flag', () => {
  const createMockEntry = (overrides: Partial<HAREntry> = {}): HAREntry => ({
    startedDateTime: '2024-01-15T10:30:00Z',
    request: {
      url: 'https://api.example.com/data',
      method: 'GET',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Content-Length', value: '1024' },
      ],
      content: {
        size: 1024,
        mimeType: 'application/json',
        text: '{"result":"success"}',
      },
    },
    time: 100,
    ...overrides,
  })

  test('should include response content when includeResponseBodies is true', () => {
    const entry = createMockEntry()
    const result = formatNetworkEntry(entry, {
      includeResponseBodies: true,
      responseBodyMode: 'full',
      index: 1,
    })

    expect(result).toContain('#### Response Content')
    expect(result).toContain('```json')
    expect(result).toContain('{"result":"success"}')
  })

  test('should omit response content when includeResponseBodies is false', () => {
    const entry = createMockEntry()
    const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })

    expect(result).not.toContain('#### Response Content')
    expect(result).not.toContain('```json')
    expect(result).not.toContain('{"result":"success"}')
  })

  test('should preserve Response Headers regardless of includeResponseBodies flag', () => {
    const entry = createMockEntry()
    const resultWithBodies = formatNetworkEntry(entry, {
      includeResponseBodies: true,
      responseBodyMode: 'full',
      index: 1,
    })
    const resultWithoutBodies = formatNetworkEntry(entry, {
      includeResponseBodies: false,
      index: 1,
    })

    expect(resultWithBodies).toContain('#### Response Headers')
    expect(resultWithoutBodies).toContain('#### Response Headers')
    expect(resultWithBodies).toContain('  Content-Type: application/json')
    expect(resultWithoutBodies).toContain('  Content-Type: application/json')
  })

  test('should preserve Size and MIME Type regardless of includeResponseBodies flag', () => {
    const entry = createMockEntry()
    const resultWithoutBodies = formatNetworkEntry(entry, {
      includeResponseBodies: false,
      index: 1,
    })

    // Size reflects the emitted body length (text.length), so the small
    // 'success' payload shows up as raw bytes rather than the original 1 KB
    // `content.size` value. MIME Type is always emitted.
    expect(resultWithoutBodies).toContain('- **Size**: 20 B')
    expect(resultWithoutBodies).toContain('- **MIME Type**: application/json')
  })

  test('should preserve request-body formatting when includeResponseBodies is false', () => {
    const entry = createMockEntry({
      request: {
        url: 'https://api.example.com/data',
        method: 'POST',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        postData: {
          mimeType: 'application/json',
          text: '{"input":"data"}',
        },
      },
    })
    const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })

    expect(result).toContain('#### Request Body')
    expect(result).toContain('```json')
    expect(result).toContain('{"input":"data"}')
  })

  test('should handle missing response content when includeResponseBodies is true', () => {
    const entry = createMockEntry({
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
      },
    })
    const result = formatNetworkEntry(entry, { includeResponseBodies: true, index: 1 })

    expect(result).not.toContain('#### Response Content')
    // No emitted body, so the Size bullet is omitted entirely (not N/A).
    expect(result).not.toContain('**Size**')
    expect(result).toContain('- **MIME Type**: unknown')
  })

  test('should use correct code-block language for HTML when includeResponseBodies is true', () => {
    const entry = createMockEntry({
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'text/html' }],
        content: {
          size: 2048,
          mimeType: 'text/html',
          text: '<html><body>Hello</body></html>',
        },
      },
    })
    const result = formatNetworkEntry(entry, {
      includeResponseBodies: true,
      responseBodyMode: 'full',
      index: 1,
    })

    expect(result).toContain('#### Response Content')
    expect(result).toContain('```html')
    expect(result).toContain('<html><body>Hello</body></html>')
  })

  test('should use correct code-block language for JavaScript when includeResponseBodies is true', () => {
    const entry = createMockEntry({
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'application/javascript' }],
        content: {
          size: 512,
          mimeType: 'application/javascript',
          text: 'console.log("test");',
        },
      },
    })
    const result = formatNetworkEntry(entry, {
      includeResponseBodies: true,
      responseBodyMode: 'full',
      index: 1,
    })

    expect(result).toContain('#### Response Content')
    expect(result).toContain('```javascript')
    expect(result).toContain('console.log("test");')
  })

  test('should use correct code-block language for CSS when includeResponseBodies is true', () => {
    const entry = createMockEntry({
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'text/css' }],
        content: {
          size: 256,
          mimeType: 'text/css',
          text: 'body { color: red; }',
        },
      },
    })
    const result = formatNetworkEntry(entry, {
      includeResponseBodies: true,
      responseBodyMode: 'full',
      index: 1,
    })

    expect(result).toContain('#### Response Content')
    expect(result).toContain('```css')
    expect(result).toContain('body { color: red; }')
  })

  test('should omit response content for non-code-block MIME types even when flag is true', () => {
    const entry = createMockEntry({
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'image/png' }],
        content: {
          size: 10240,
          mimeType: 'image/png',
          text: 'binary-data',
        },
      },
    })
    const result = formatNetworkEntry(entry, { includeResponseBodies: true, index: 1 })

    expect(result).not.toContain('#### Response Content')
    // Size now reflects text.length (the post-truncation emitted bytes).
    expect(result).toContain('- **Size**: 11 B')
    expect(result).toContain('- **MIME Type**: image/png')
  })

  describe('formatNetworkEntry - header filtering', () => {
    test('should summarize request cookie header', () => {
      const entry = createMockEntry({
        request: {
          url: 'https://example.com/data',
          method: 'GET',
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'cookie', value: 'a=1; b=2; c=3' },
          ],
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).toContain('[3 cookies,')
      expect(result).not.toContain('a=1; b=2')
      expect(result).toContain('Content-Type: application/json')
    })

    test('should summarize multiple set-cookie response headers', () => {
      const entry = createMockEntry({
        response: {
          status: 200,
          statusText: 'OK',
          headers: [
            { name: 'Content-Type', value: 'text/html' },
            { name: 'set-cookie', value: 'session=abc123; Path=/' },
            { name: 'Set-Cookie', value: 'theme=dark; Path=/' },
          ],
          content: { size: 100, mimeType: 'text/html' },
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).toContain('set-cookie')
      expect(result).toContain('[2 cookies set,')
      expect(result).not.toContain('session=abc123')
      expect(result).toContain('Content-Type: text/html')
    })

    test('should suppress sec-ch-ua client hint headers', () => {
      const entry = createMockEntry({
        request: {
          url: 'https://example.com/data',
          method: 'GET',
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'sec-ch-ua', value: '"Chrome";v="145"' },
            { name: 'sec-ch-ua-arch', value: '"x86"' },
            { name: 'sec-ch-ua-platform', value: '"Linux"' },
          ],
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).not.toContain('sec-ch-ua')
      expect(result).not.toContain('"Chrome"')
      expect(result).toContain('Content-Type: application/json')
    })

    test('should suppress HTTP/2 pseudo-headers', () => {
      const entry = createMockEntry({
        request: {
          url: 'https://example.com/data',
          method: 'GET',
          headers: [
            { name: ':authority', value: 'example.com' },
            { name: ':method', value: 'GET' },
            { name: ':path', value: '/data' },
            { name: ':scheme', value: 'https' },
            { name: 'Content-Type', value: 'application/json' },
          ],
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).not.toContain(':authority')
      expect(result).not.toContain(':method')
      expect(result).not.toContain(':path')
      expect(result).not.toContain(':scheme')
      expect(result).toContain('Content-Type: application/json')
    })

    test('should suppress browser internal headers', () => {
      const entry = createMockEntry({
        request: {
          url: 'https://example.com/data',
          method: 'GET',
          headers: [
            { name: 'accept', value: '*/*' },
            { name: 'accept-encoding', value: 'gzip, deflate' },
            { name: 'x-browser-channel', value: 'stable' },
            { name: 'x-client-data', value: 'abc123' },
            { name: 'Content-Type', value: 'application/json' },
          ],
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).not.toContain('accept:')
      expect(result).not.toContain('accept-encoding')
      expect(result).not.toContain('x-browser-channel')
      expect(result).not.toContain('x-client-data')
      expect(result).toContain('Content-Type: application/json')
    })

    test('should suppress low-signal response headers on successful responses', () => {
      const entry = createMockEntry({
        response: {
          status: 200,
          statusText: 'OK',
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'alt-svc', value: 'h3=":443"' },
            { name: 'content-security-policy', value: "default-src 'self'" },
            { name: 'report-to', value: '{"group":"default"}' },
            { name: 'date', value: 'Tue, 07 Apr 2026 23:16:19 GMT' },
          ],
          content: { size: 100, mimeType: 'application/json' },
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).toContain('Content-Type: application/json')
      expect(result).not.toContain('alt-svc')
      expect(result).not.toContain('content-security-policy')
      expect(result).not.toContain('report-to')
      expect(result).not.toContain('date:')
    })

    test('should keep all response headers on error responses', () => {
      const entry = createMockEntry({
        response: {
          status: 403,
          statusText: 'Forbidden',
          headers: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'content-security-policy', value: "default-src 'self'" },
            { name: 'date', value: 'Tue, 07 Apr 2026 23:16:19 GMT' },
            { name: 'alt-svc', value: 'h3=":443"' },
          ],
          content: { size: 50, mimeType: 'application/json' },
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).toContain('Content-Type: application/json')
      expect(result).toContain('content-security-policy')
      expect(result).toContain('date:')
      expect(result).toContain('alt-svc')
    })

    test('should skip header sections entirely for 204 responses', () => {
      const entry = createMockEntry({
        response: {
          status: 204,
          statusText: 'No Content',
          headers: [
            { name: 'Content-Type', value: 'text/html' },
            { name: 'date', value: 'Tue, 07 Apr 2026 23:16:19 GMT' },
          ],
          content: { size: 0, mimeType: 'text/html' },
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).toContain('### #1 GET')
      expect(result).toContain('- **Status**: 204')
      expect(result).not.toContain('#### Request Headers')
      expect(result).not.toContain('#### Response Headers')
      expect(result).not.toContain('Content-Type')
    })

    test('should show request body for 204 responses if present', () => {
      const entry = createMockEntry({
        request: {
          url: 'https://example.com/data',
          method: 'POST',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          postData: {
            mimeType: 'application/json',
            text: '{"action":"ping"}',
          },
        },
        response: {
          status: 204,
          statusText: 'No Content',
          headers: [],
          content: { size: 0, mimeType: 'text/html' },
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).not.toContain('#### Request Headers')
      expect(result).not.toContain('#### Response Headers')
      expect(result).toContain('#### Request Body')
      expect(result).toContain('{"action":"ping"}')
    })

    test('should omit Request Headers section when all headers are suppressed', () => {
      const entry = createMockEntry({
        request: {
          url: 'https://example.com/data',
          method: 'GET',
          headers: [
            { name: ':authority', value: 'example.com' },
            { name: 'accept', value: '*/*' },
            { name: 'sec-ch-ua', value: '"Chrome"' },
          ],
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      // Empty header block now omits the section entirely (no more "None" placeholder).
      expect(result).not.toContain('#### Request Headers')
      expect(result).not.toContain('None')
      expect(result).not.toContain(':authority')
      expect(result).not.toContain('accept:')
      expect(result).not.toContain('sec-ch-ua')
    })

    test('should match header names case-insensitively', () => {
      const entry = createMockEntry({
        request: {
          url: 'https://example.com/data',
          method: 'GET',
          headers: [
            { name: 'Accept', value: '*/*' },
            { name: 'ACCEPT-ENCODING', value: 'gzip' },
            { name: 'Sec-CH-UA', value: '"Chrome"' },
            { name: 'Cookie', value: 'a=1; b=2' },
            { name: 'Content-Type', value: 'application/json' },
          ],
        },
      })
      const result = formatNetworkEntry(entry, { includeResponseBodies: false, index: 1 })
      expect(result).not.toContain('Accept:')
      expect(result).not.toContain('ACCEPT-ENCODING')
      expect(result).not.toContain('Sec-CH-UA')
      expect(result).toContain('Cookie: [2 cookies,')
      expect(result).toContain('Content-Type: application/json')
    })
  })

  describe('formatResponseSection - responseBodyMode flag', () => {
    const longBody = `{"data":"${'x'.repeat(8000)}"}`

    test('full mode: shows full body', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: {
          size: longBody.length,
          mimeType: 'application/json',
          text: longBody,
        },
      }
      const result = formatResponseSection(response, 'application/json', true, false, true, 'full')

      expect(result).toContain(longBody)
      expect(result).not.toContain('Body elided')
    })

    test('smart mode + elevated: shows full body', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: {
          size: longBody.length,
          mimeType: 'application/json',
          text: longBody,
        },
      }
      const result = formatResponseSection(
        response,
        'application/json',
        true,
        false,
        true,
        'smart',
        true
      )

      expect(result).toContain(longBody)
      expect(result).not.toContain('Body elided')
    })

    test('smart mode + not elevated: elides body with sketch', () => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: {
          size: longBody.length,
          mimeType: 'application/json',
          text: longBody,
        },
      }
      const result = formatResponseSection(
        response,
        'application/json',
        true,
        false,
        true,
        'smart',
        false
      )

      expect(result).toContain('- **Body elided (smart mode)**:')
      expect(result).not.toContain(longBody)
    })

    test('full mode in formatNetworkEntry: shows full body', () => {
      const entry = createMockEntry({
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: {
            size: longBody.length,
            mimeType: 'application/json',
            text: longBody,
          },
        },
      })
      const result = formatNetworkEntry(entry, {
        includeResponseBodies: true,
        responseBodyMode: 'full',
        index: 1,
      })

      expect(result).toContain(longBody)
      expect(result).not.toContain('Body elided')
    })

    test('smart mode + elevated in formatNetworkEntry: shows full body', () => {
      const entry = createMockEntry({
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: {
            size: longBody.length,
            mimeType: 'application/json',
            text: longBody,
          },
        },
      })
      const result = formatNetworkEntry(entry, {
        includeResponseBodies: true,
        responseBodyMode: 'smart',
        elevatedUrlPaths: new Set(['/data']),
        index: 1,
      })

      expect(result).toContain(longBody)
      expect(result).not.toContain('Body elided')
    })

    test('smart mode + non-elevated in formatNetworkEntry: elides body', () => {
      const entry = createMockEntry({
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: {
            size: longBody.length,
            mimeType: 'application/json',
            text: longBody,
          },
        },
      })
      const result = formatNetworkEntry(entry, {
        includeResponseBodies: true,
        responseBodyMode: 'smart',
        index: 1,
      })

      expect(result).toContain('- **Body elided (smart mode)**:')
      expect(result).not.toContain(longBody)
    })
  })

  describe('formatConsolidatedNetworkEntry - polling dedup', () => {
    const makeResponse = (bodyText: string) => ({
      status: 200,
      statusText: 'OK',
      headers: [{ name: 'Content-Type', value: 'application/json' }],
      content: { size: bodyText.length, mimeType: 'application/json', text: bodyText },
    })

    const firstBody = '{"status":"pending"}'
    const matureBody = '{"status":"completed","data":[1,2,3]}'

    test('should deduplicate identical subsequent response diffs for polling endpoints', () => {
      const group: ConsolidatedNetworkEntry = {
        entries: [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'https://api.example.com/poll', method: 'GET' },
            response: makeResponse(firstBody),
            time: 50,
          },
          {
            startedDateTime: '2024-01-15T10:30:01Z',
            request: { url: 'https://api.example.com/poll', method: 'GET' },
            response: makeResponse(matureBody),
            time: 50,
          },
          {
            startedDateTime: '2024-01-15T10:30:02Z',
            request: { url: 'https://api.example.com/poll', method: 'GET' },
            response: makeResponse(matureBody),
            time: 50,
          },
          {
            startedDateTime: '2024-01-15T10:30:03Z',
            request: { url: 'https://api.example.com/poll', method: 'GET' },
            response: makeResponse(matureBody),
            time: 50,
          },
        ],
        key: 'GET::https://api.example.com/poll::',
        method: 'GET',
        url: 'https://api.example.com/poll',
        identicalResponses: false,
        bodyDiffs: [
          { entryIndex: 0, timestamp: '2024-01-15T10:30:00Z', hasDiff: false },
          {
            entryIndex: 1,
            timestamp: '2024-01-15T10:30:01Z',
            hasDiff: true,
            diffLines: ['- {"status":"pending"}', '+ {"status":"completed","data":[1,2,3]}'],
          },
          {
            entryIndex: 2,
            timestamp: '2024-01-15T10:30:02Z',
            hasDiff: true,
            diffLines: ['- {"status":"pending"}', '+ {"status":"completed","data":[1,2,3]}'],
          },
          {
            entryIndex: 3,
            timestamp: '2024-01-15T10:30:03Z',
            hasDiff: true,
            diffLines: ['- {"status":"pending"}', '+ {"status":"completed","data":[1,2,3]}'],
          },
        ],
        count: 4,
        timestamps: [
          '2024-01-15T10:30:00Z',
          '2024-01-15T10:30:01Z',
          '2024-01-15T10:30:02Z',
          '2024-01-15T10:30:03Z',
        ],
      }

      const result = formatConsolidatedNetworkEntry(group, {
        includeResponseBodies: true,
        responseBodyMode: 'full',
        index: 1,
      })

      // Should show the first diff (call 2 → call 1 transition)
      expect(result).toContain('Call 2')
      expect(result).toContain('{"status":"completed"')

      // Should NOT repeat identical diffs for calls 3 and 4
      expect(result).not.toContain('Call 3')
      expect(result).not.toContain('Call 4')

      // Should include dedup notice
      expect(result).toContain('identical')
    })

    test('should still show unique diffs when subsequent responses keep changing', () => {
      const body3 = '{"status":"completed","data":[1,2,3,4]}'
      const group: ConsolidatedNetworkEntry = {
        entries: [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'https://api.example.com/poll', method: 'GET' },
            response: makeResponse(firstBody),
            time: 50,
          },
          {
            startedDateTime: '2024-01-15T10:30:01Z',
            request: { url: 'https://api.example.com/poll', method: 'GET' },
            response: makeResponse(matureBody),
            time: 50,
          },
          {
            startedDateTime: '2024-01-15T10:30:02Z',
            request: { url: 'https://api.example.com/poll', method: 'GET' },
            response: makeResponse(body3),
            time: 50,
          },
        ],
        key: 'GET::https://api.example.com/poll::',
        method: 'GET',
        url: 'https://api.example.com/poll',
        identicalResponses: false,
        bodyDiffs: [
          { entryIndex: 0, timestamp: '2024-01-15T10:30:00Z', hasDiff: false },
          {
            entryIndex: 1,
            timestamp: '2024-01-15T10:30:01Z',
            hasDiff: true,
            diffLines: ['- {"status":"pending"}', '+ {"status":"completed","data":[1,2,3]}'],
          },
          {
            entryIndex: 2,
            timestamp: '2024-01-15T10:30:02Z',
            hasDiff: true,
            diffLines: ['- {"status":"pending"}', '+ {"status":"completed","data":[1,2,3,4]}'],
          },
        ],
        count: 3,
        timestamps: ['2024-01-15T10:30:00Z', '2024-01-15T10:30:01Z', '2024-01-15T10:30:02Z'],
      }

      const result = formatConsolidatedNetworkEntry(group, {
        includeResponseBodies: true,
        responseBodyMode: 'full',
        index: 1,
      })

      // Both unique diffs should appear
      expect(result).toContain('Call 2')
      expect(result).toContain('Call 3')
      expect(result).not.toContain('identical')
    })

    test('should not deduplicate when there are only 2 calls', () => {
      const group: ConsolidatedNetworkEntry = {
        entries: [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'https://api.example.com/poll', method: 'GET' },
            response: makeResponse(firstBody),
            time: 50,
          },
          {
            startedDateTime: '2024-01-15T10:30:01Z',
            request: { url: 'https://api.example.com/poll', method: 'GET' },
            response: makeResponse(matureBody),
            time: 50,
          },
        ],
        key: 'GET::https://api.example.com/poll::',
        method: 'GET',
        url: 'https://api.example.com/poll',
        identicalResponses: false,
        bodyDiffs: [
          { entryIndex: 0, timestamp: '2024-01-15T10:30:00Z', hasDiff: false },
          {
            entryIndex: 1,
            timestamp: '2024-01-15T10:30:01Z',
            hasDiff: true,
            diffLines: ['- {"status":"pending"}', '+ {"status":"completed","data":[1,2,3]}'],
          },
        ],
        count: 2,
        timestamps: ['2024-01-15T10:30:00Z', '2024-01-15T10:30:01Z'],
      }

      const result = formatConsolidatedNetworkEntry(group, {
        includeResponseBodies: true,
        responseBodyMode: 'full',
        index: 1,
      })

      expect(result).toContain('Call 2')
      expect(result).not.toContain('identical')
    })
  })

  describe('formatConsolidatedNetworkEntry - request body on failure', () => {
    test('should show request body for POST that returns 500', () => {
      const entry: HAREntry = {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://api.example.com/submit',
          method: 'POST',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          postData: {
            mimeType: 'application/json',
            text: '{"userId":42,"action":"submit"}',
          },
        },
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: { size: 50, mimeType: 'application/json', text: '{"error":"server fault"}' },
        },
        time: 100,
      }

      const result = formatNetworkEntry(entry, {
        includeResponseBodies: true,
        responseBodyMode: 'full',
        index: 1,
      })

      // Request body should be shown for failed request
      expect(result).toContain('#### Request Body')
      expect(result).toContain('{"userId":42,"action":"submit"}')
      expect(result).toContain('```json')
    })

    test('should show request body for POST that returns 400', () => {
      const entry: HAREntry = {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://api.example.com/validate',
          method: 'POST',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          postData: {
            mimeType: 'application/json',
            text: '{"invalid":"payload"}',
          },
        },
        response: {
          status: 400,
          statusText: 'Bad Request',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
        },
        time: 50,
      }

      const result = formatNetworkEntry(entry, {
        includeResponseBodies: true,
        responseBodyMode: 'full',
        index: 1,
      })

      expect(result).toContain('#### Request Body')
      expect(result).toContain('{"invalid":"payload"}')
    })
  })

  describe('formatConsolidatedMeta - status range', () => {
    test('should show single status when all entries have same status', () => {
      const group: ConsolidatedNetworkEntry = {
        entries: [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'https://api.example.com/items', method: 'GET' },
            response: { status: 200, statusText: 'OK' },
            time: 50,
          },
          {
            startedDateTime: '2024-01-15T10:30:01Z',
            request: { url: 'https://api.example.com/items', method: 'GET' },
            response: { status: 200, statusText: 'OK' },
            time: 50,
          },
        ],
        key: 'GET::https://api.example.com/items::',
        method: 'GET',
        url: 'https://api.example.com/items',
        identicalResponses: true,
        bodyDiffs: [],
        count: 2,
        timestamps: ['2024-01-15T10:30:00Z', '2024-01-15T10:30:01Z'],
      }

      const result = formatConsolidatedNetworkEntry(group, {
        includeResponseBodies: false,
        index: 1,
      })

      expect(result).toContain('- **Status**: 200')
      // Should not show range when all same
      expect(result).not.toContain('**Status**: 200/')
    })

    test('should show status range when entries have mixed statuses', () => {
      const group: ConsolidatedNetworkEntry = {
        entries: [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'https://api.example.com/submit', method: 'POST' },
            response: { status: 500, statusText: 'Internal Server Error' },
            time: 50,
          },
          {
            startedDateTime: '2024-01-15T10:30:01Z',
            request: { url: 'https://api.example.com/submit', method: 'POST' },
            response: { status: 200, statusText: 'OK' },
            time: 50,
          },
        ],
        key: 'POST::https://api.example.com/submit::',
        method: 'POST',
        url: 'https://api.example.com/submit',
        identicalResponses: false,
        bodyDiffs: [
          {
            entryIndex: 0,
            timestamp: '2024-01-15T10:30:00Z',
            hasDiff: false,
          },
        ],
        count: 2,
        timestamps: ['2024-01-15T10:30:00Z', '2024-01-15T10:30:01Z'],
      }

      const result = formatConsolidatedNetworkEntry(group, {
        includeResponseBodies: true,
        responseBodyMode: 'full',
        index: 1,
      })

      expect(result).toContain('- **Status**: 200/500')
    })
  })
})
