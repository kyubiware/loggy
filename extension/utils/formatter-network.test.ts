/**
 * Tests for utils/formatter-network.ts
 * Test coverage for formatNetworkEntry() with includeResponseBodies flag
 */

import { describe, expect, test } from 'vitest'
import type { HAREntry } from '../types/har'
import { formatNetworkEntry } from './formatter-network'

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
    const result = formatNetworkEntry(entry, { includeResponseBodies: true })

    expect(result).toContain('#### Response Content')
    expect(result).toContain('```json')
    expect(result).toContain('{"result":"success"}')
  })

  test('should omit response content when includeResponseBodies is false', () => {
    const entry = createMockEntry()
    const result = formatNetworkEntry(entry, { includeResponseBodies: false })

    expect(result).not.toContain('#### Response Content')
    expect(result).not.toContain('```json')
    expect(result).not.toContain('{"result":"success"}')
  })

  test('should preserve Response Headers regardless of includeResponseBodies flag', () => {
    const entry = createMockEntry()
    const resultWithBodies = formatNetworkEntry(entry, {
      includeResponseBodies: true,
    })
    const resultWithoutBodies = formatNetworkEntry(entry, {
      includeResponseBodies: false,
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
    })

    expect(resultWithoutBodies).toContain('- **Size**: 1 KB')
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
    const result = formatNetworkEntry(entry, { includeResponseBodies: false })

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
    const result = formatNetworkEntry(entry, { includeResponseBodies: true })

    expect(result).not.toContain('#### Response Content')
    expect(result).toContain('- **Size**: N/A')
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
    const result = formatNetworkEntry(entry, { includeResponseBodies: true })

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
    const result = formatNetworkEntry(entry, { includeResponseBodies: true })

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
    const result = formatNetworkEntry(entry, { includeResponseBodies: true })

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
    const result = formatNetworkEntry(entry, { includeResponseBodies: true })

    expect(result).not.toContain('#### Response Content')
    expect(result).toContain('- **Size**: 10 KB')
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
      expect(result).toContain('### GET')
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
      expect(result).not.toContain('#### Request Headers')
      expect(result).not.toContain('#### Response Headers')
      expect(result).toContain('#### Request Body')
      expect(result).toContain('{"action":"ping"}')
    })

    test('should show None when all request headers are suppressed', () => {
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
      expect(result).toContain('None')
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
      const result = formatNetworkEntry(entry, { includeResponseBodies: false })
      expect(result).not.toContain('Accept:')
      expect(result).not.toContain('ACCEPT-ENCODING')
      expect(result).not.toContain('Sec-CH-UA')
      expect(result).toContain('Cookie: [2 cookies,')
      expect(result).toContain('Content-Type: application/json')
    })
  })
})
