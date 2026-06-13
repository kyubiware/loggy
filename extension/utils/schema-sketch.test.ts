/**
 * Test suite for utils/schema-sketch.ts
 * Tests the sketchJsonBody helper used for smart-truncation export mode.
 */

import { describe, expect, test } from 'vitest'
import { sketchJsonBody } from './schema-sketch'

describe('sketchJsonBody', () => {
  describe('defensive cap — >200KB input', () => {
    test('returns too-large marker for oversized input', () => {
      const big = 'x'.repeat(200_001)
      expect(sketchJsonBody(big)).toBe('(195.31 KB, too large to sketch)')
    })

    test('exactly 200KB is allowed to parse', () => {
      const big = `{${'"a":1,'.repeat(10000)}"b":1}`
      expect(sketchJsonBody(big)).not.toContain('too large to sketch')
    })
  })

  describe('empty string', () => {
    test('without mime type', () => {
      expect(sketchJsonBody('')).toBe('(0 B)')
    })

    test('with mime type', () => {
      expect(sketchJsonBody('', 'application/json')).toBe('(0 B, application/json)')
    })
  })

  describe('JSON objects', () => {
    test('simple object with 3 keys', () => {
      const json = JSON.stringify({ id: 1, email: 'a@b.com', username: 'alice' })
      expect(sketchJsonBody(json)).toBe('{id, email, username}')
    })

    test('object with 12 keys shows 6 shown + …+6', () => {
      const obj: Record<string, number> = {}
      for (let i = 0; i < 12; i++) obj[`key${i}`] = i
      expect(sketchJsonBody(JSON.stringify(obj))).toBe('{key0, key1, key2, key3, key4, key5, …+6}')
    })

    test('object with exactly 6 keys — no suffix', () => {
      const obj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 }
      expect(sketchJsonBody(JSON.stringify(obj))).toBe('{a, b, c, d, e, f}')
    })

    test('object with 7 keys shows 6 + …+1', () => {
      const obj: Record<string, number> = {}
      for (let i = 0; i < 7; i++) obj[`k${i}`] = i
      expect(sketchJsonBody(JSON.stringify(obj))).toBe('{k0, k1, k2, k3, k4, k5, …+1}')
    })

    test('empty object', () => {
      expect(sketchJsonBody('{}')).toBe('{}')
    })

    test('key longer than 20 characters is truncated', () => {
      const obj = { supercalifragilisticexpialidocious: 1 }
      // "supercalifragilisticexpialidocious" is 34 chars.
      // Truncated to 17 chars + '…' = "supercalifragilis…"
      expect(sketchJsonBody(JSON.stringify(obj))).toBe('{supercalifragilis…}')
    })

    test('key exactly 20 characters is NOT truncated', () => {
      const key = 'a'.repeat(20)
      const obj = { [key]: 1 }
      expect(sketchJsonBody(JSON.stringify(obj))).toBe(`{${key}}`)
    })

    test('key 21 characters IS truncated', () => {
      const key = 'a'.repeat(21)
      const obj = { [key]: 1 }
      expect(sketchJsonBody(JSON.stringify(obj))).toBe(`${'{'}${'a'.repeat(17)}…}`)
    })
  })

  describe('JSON arrays', () => {
    test('empty array', () => {
      expect(sketchJsonBody('[]')).toBe('[]')
    })

    test('array of primitives', () => {
      expect(sketchJsonBody('[1, 2, 3]')).toBe('[Item] × 3')
    })

    test('array of heterogeneous items (mixed primitives and objects)', () => {
      expect(sketchJsonBody('[1, {"id": 1}, "hello"]')).toBe('[Item] × 3')
    })

    test('array of homogeneous objects', () => {
      const arr = [
        { id: 1, title: 'foo' },
        { id: 2, title: 'bar' },
      ]
      expect(sketchJsonBody(JSON.stringify(arr))).toBe('[Item] × 2 (first: {id, title})')
    })

    test('array of homogeneous objects with many keys on first item', () => {
      const first: Record<string, number> = {}
      for (let i = 0; i < 10; i++) first[`k${i}`] = i
      const arr = [first, { k0: 1 }]
      expect(sketchJsonBody(JSON.stringify(arr))).toBe(
        '[Item] × 2 (first: {k0, k1, k2, k3, k4, k5, …+4})'
      )
    })

    test('array of objects where first item is empty object', () => {
      const arr = [{}, { a: 1 }]
      expect(sketchJsonBody(JSON.stringify(arr))).toBe('[Item] × 2 (first: {})')
    })

    test('array with nested arrays (not objects)', () => {
      expect(sketchJsonBody('[[1], [2]]')).toBe('[Item] × 2')
    })

    test('array with null items (null is not an object)', () => {
      expect(sketchJsonBody('[null, null]')).toBe('[Item] × 2')
    })
  })

  describe('top-level JSON primitives', () => {
    test('boolean true', () => {
      expect(sketchJsonBody('true')).toBe('(4 B, boolean)')
    })

    test('boolean false', () => {
      expect(sketchJsonBody('false')).toBe('(5 B, boolean)')
    })

    test('null', () => {
      expect(sketchJsonBody('null')).toBe('(4 B, null)')
    })

    test('number', () => {
      expect(sketchJsonBody('42')).toBe('(2 B, number)')
    })

    test('negative number', () => {
      expect(sketchJsonBody('-42')).toBe('(3 B, number)')
    })

    test('quoted string', () => {
      expect(sketchJsonBody('"hello"')).toBe('(7 B, string)')
    })
  })

  describe('parse failures and fallbacks', () => {
    test('malformed JSON starting with { falls back to MIME format', () => {
      expect(sketchJsonBody('{"a":1, broken', 'application/json')).toBe('(14 B, application/json)')
    })

    test('malformed JSON starting with { and no mime', () => {
      expect(sketchJsonBody('{"a":1, broken')).toBe('(14 B)')
    })

    test('malformed JSON starting with [ falls back to MIME format', () => {
      expect(sketchJsonBody('[1, 2, broken', 'text/plain')).toBe('(13 B, text/plain)')
    })
  })

  describe('non-JSON content', () => {
    test('HTML with mime type', () => {
      expect(sketchJsonBody('<html><body>Hello</body></html>', 'text/html')).toBe(
        '(31 B, text/html)'
      )
    })

    test('plain text without mime type', () => {
      expect(sketchJsonBody('Hello, World!')).toBe('(13 B)')
    })

    test('whitespace-only input', () => {
      expect(sketchJsonBody('   ', 'text/plain')).toBe('(3 B, text/plain)')
    })
  })

  describe('MIME hint with JSON content', () => {
    test('mime hint present but text starts with { — treat as JSON', () => {
      expect(sketchJsonBody('{"a":1, "b":2}', 'text/html')).toBe('{a, b}')
    })

    test('mime hint present but text starts with [ — treat as JSON', () => {
      expect(sketchJsonBody('[1, 2, 3]', 'application/octet-stream')).toBe('[Item] × 3')
    })
  })

  describe('realistic shapes', () => {
    test('typical API error response', () => {
      const json = JSON.stringify({
        error: 'not_found',
        message: 'The requested resource was not found',
        status_code: 404,
      })
      expect(sketchJsonBody(json)).toBe('{error, message, status_code}')
    })

    test('large flat response with many keys', () => {
      const obj: Record<string, string> = {}
      for (let i = 0; i < 20; i++) obj[`field_${i}`] = `value${i}`
      expect(sketchJsonBody(JSON.stringify(obj))).toBe(
        '{field_0, field_1, field_2, field_3, field_4, field_5, …+14}'
      )
    })
  })
})
