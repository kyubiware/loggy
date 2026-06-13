/**
 * Test suite for utils/formatter-strings.ts
 * Tests the truncate and truncateJSON helpers used by network/console formatters.
 */

import { describe, expect, test } from 'vitest'
import { truncate, truncateJSON } from './formatter-strings'

describe('truncate', () => {
  test('returns the original string when within the limit', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  test('returns empty string for empty input', () => {
    expect(truncate('', 100)).toBe('')
  })

  test('uses the new byte-count marker on its own line', () => {
    const input = 'A'.repeat(20)
    const result = truncate(input, 10)
    expect(result).toBe(`${'A'.repeat(10)}\n… [truncated, showed 10 of 20 bytes]`)
  })

  test('marker lives on a new line and includes both byte counts', () => {
    const result = truncate('x'.repeat(50), 5)
    expect(result).toContain('\n… [truncated,')
    expect(result).toContain('showed 5 of 50 bytes')
  })

  test('exact-boundary input is returned unchanged', () => {
    const input = 'B'.repeat(10)
    expect(truncate(input, 10)).toBe(input)
  })
})

describe('truncateJSON', () => {
  test('returns short JSON unchanged (passthrough)', () => {
    const json = '{"a":1,"b":2}'
    expect(truncateJSON(json, 1000)).toBe(json)
  })

  test('returns empty string for empty input', () => {
    expect(truncateJSON('', 1000)).toBe('')
  })

  test('returns empty string for undefined input', () => {
    // The signature is `string`; test the falsy-input guard explicitly.
    expect(truncateJSON(undefined as unknown as string, 1000)).toBe('')
  })

  test('cuts a long JSON array at the element boundary with byte counts', () => {
    // 200 small elements, each ~10 chars
    const elements = Array.from({ length: 200 }, (_, i) => `{"i":${i}}`).join(',')
    const json = `[${elements}]`
    const result = truncateJSON(json, 200)
    expect(result).toContain('/* truncated: showed ')
    expect(result).toContain('bytes */')
    // The result already includes the appended closing `]` — it must parse.
    const [prefix] = result.split('\n')
    expect(() => JSON.parse(prefix)).not.toThrow()
    // Total length marker reports the FULL original byte count
    expect(result).toContain(`of ${json.length} bytes`)
  })

  test('cuts a long JSON object at a field boundary', () => {
    const fields = Array.from({ length: 200 }, (_, i) => `"k${i}":${i}`).join(',')
    const json = `{${fields}}`
    const result = truncateJSON(json, 200)
    expect(result).toContain('/* truncated: showed ')
    const [prefix] = result.split('\n')
    // The result already includes the appended closing `}` — it must parse.
    expect(() => JSON.parse(prefix)).not.toThrow()
    expect(result).toContain(`of ${json.length} bytes`)
  })

  test('manually closes open containers when no safe cut exists before the limit', () => {
    // Build a JSON that opens `{ [` then never closes — the scanner will
    // reach maxLength before seeing any `,` / `}` / `]`.
    const json = `{"a":${'['.repeat(20)}${'1,'.repeat(1500)}`
    const result = truncateJSON(json, 100)
    expect(result).toContain('/* truncated: showed 100 of ')
    // The emitted prefix should at least be balanced to the point of the cut.
    // The closing-bracket string appended by truncateJSON comes before the marker.
    const [prefix] = result.split('\n')
    const opens = (prefix.match(/[[{]/g) ?? []).length
    const closes = (prefix.match(/[\]}]/g) ?? []).length
    expect(opens).toBe(closes)
  })

  test('falls through to simple truncate() for non-JSON long strings', () => {
    const text = 'plain text body, not JSON at all, just lots of words. '.repeat(100)
    const result = truncateJSON(text, 100)
    // Non-JSON falls through, so it uses the truncate marker (`[truncated,`)
    expect(result).toContain('[truncated,')
    expect(result).toContain('bytes]')
    // No JSON marker (`/*`) should be present in the non-JSON path
    expect(result).not.toContain('/* truncated')
  })

  test('falls through to simple truncate() for JSON-like text without leading brace/bracket', () => {
    // A leading non-whitespace character that is not `{` or `[` is not JSON.
    const text = `42 is the answer and here is a lot of trailing content ${'x'.repeat(500)}`
    const result = truncateJSON(text, 100)
    expect(result).toContain('[truncated,')
    expect(result).not.toContain('/* truncated')
  })

  test('handles nested objects with strings containing `{` and escaped quotes', () => {
    // String values contain literal `{` and escaped `\"` — depth tracking must
    // treat these as inside-strings and not change depth.
    const json = '{"a":"hello { world}","b":"escaped \\" quote","c":{"d":"inner { brace }"}}'
    expect(truncateJSON(json, 10000)).toBe(json)
  })

  test('preserves surrogate pairs when iterating codepoints', () => {
    // Each emoji is a surrogate pair in UTF-16 (2 code units each).
    const emoji = '😀😁😂🤣😃😄😅😆😉😊😋😎😍😘🥰'
    const json = `{"label":"${emoji}","value":1}`
    const result = truncateJSON(json, 10000)
    expect(result).toBe(json)
    // The full emoji should be intact (no split surrogate)
    expect(result).toContain(emoji)
  })

  test('emits the closing-bracket run for an array cut mid-elements', () => {
    const json = `[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]`
    const result = truncateJSON(json, 8)
    const [prefix] = result.split('\n')
    // The prefix already includes the appended `]` — it must parse as an array.
    expect(() => JSON.parse(prefix)).not.toThrow()
    const parsed = JSON.parse(prefix) as number[]
    expect(Array.isArray(parsed)).toBe(true)
  })

  test('marker reports the total original byte count, not the slice size', () => {
    const json = `{"items":[${Array.from({ length: 50 }, (_, i) => i).join(',')}]}`
    const result = truncateJSON(json, 30)
    expect(result).toContain(`of ${json.length} bytes`)
  })

  test('truncated JSON for a well-formed object is itself parseable (safe-cut path)', () => {
    const json = `{"a":1,"b":[1,2,3],"c":{"d":4,"e":[5,6,7,8,9,10]}}`
    const result = truncateJSON(json, 30)
    const [prefix] = result.split('\n')
    // Whatever closing brackets truncateJSON appended, the result must parse.
    expect(() => JSON.parse(prefix)).not.toThrow()
  })
})

describe('truncateJSON — sanity oracle: property test on random valid JSON', () => {
  // Deterministic PRNG so failures are reproducible.
  let seed = 0xc0ffee
  function rand(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  function randInt(min: number, max: number): number {
    return Math.floor(rand() * (max - min + 1)) + min
  }
  function randomString(): string {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-.'
    let out = ''
    const len = randInt(0, 12)
    for (let i = 0; i < len; i++) {
      out += alphabet[randInt(0, alphabet.length - 1)]
    }
    return out
  }
  function randomValue(): unknown {
    const pick = rand()
    if (pick < 0.25) return randInt(-100, 100)
    if (pick < 0.45) return rand() < 0.5
    if (pick < 0.55) return null
    if (pick < 0.8) return randomString()
    if (pick < 0.9) return randomArray()
    return randomObject()
  }
  function randomArray(): unknown[] {
    const len = randInt(0, 8)
    return Array.from({ length: len }, () => randomValue())
  }
  function randomObject(): Record<string, unknown> {
    const len = randInt(0, 6)
    const obj: Record<string, unknown> = {}
    for (let i = 0; i < len; i++) {
      obj[`k${randInt(0, 99)}`] = randomValue()
    }
    return obj
  }

  test('JSON.parse(truncateJSON(json, N)) does not throw when a safe cut exists', () => {
    let safeCutChecks = 0
    for (let trial = 0; trial < 50; trial++) {
      seed = 0xc0ffee + trial
      const root = rand() < 0.5 ? randomArray() : randomObject()
      const json = JSON.stringify(root)
      // Force a real truncation by picking a maxLength smaller than the json.
      const maxLength = randInt(10, Math.max(11, Math.floor(json.length * 0.6)))
      const result = truncateJSON(json, maxLength)
      const [prefix] = result.split('\n')
      // The marker records which character count was shown. When a safe cut
      // was found, the marker shows `lastSafeCut` (a position where the JSON
      // up to that point is structurally complete). When no safe cut was
      // found before maxLength, the marker shows `maxLength` itself and the
      // prefix may be mid-value (unterminated string, etc.) — that case is
      // outside the oracle's scope.
      const match = result.match(/showed (\d+) of \d+ bytes/)
      const showed = match ? Number.parseInt(match[1], 10) : maxLength
      if (showed >= maxLength) continue
      expect(() => JSON.parse(prefix)).not.toThrow()
      safeCutChecks++
    }
    // Sanity: ensure at least one trial exercised the safe-cut path.
    expect(safeCutChecks).toBeGreaterThan(0)
  })
})
