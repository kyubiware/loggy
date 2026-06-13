/**
 * One-line schema sketch of an HTTP response body for smart-truncation export mode.
 *
 * Produces a terse structural summary — top-level keys for objects, item count
 * for arrays, primitive type for scalars — without rendering the full payload.
 */

import { formatBytes } from './formatter-strings'

const MAX_SHOWN_KEYS = 6
const MAX_KEY_LENGTH = 20
const TRUNCATED_KEY_LENGTH = 17

/**
 * Returns a one-line description of `text` as a JSON structure.
 *
 * - **Object** `{ … }` – comma-joined top-level keys (capped at 6, longer keys
 *   truncated at 20 chars, remainder shown as `…+N`).
 * - **Array** `[ … ]` – item count, with first-item schema when all items are
 *   plain objects.
 * - **Primitive** – size and type, e.g. `(42 B, boolean)`.
 * - **Non-JSON / parse failure** – size and optional MIME type, e.g. `(1.2 KB,
 *   text/html)`.
 *
 * @param text - Raw response body
 * @param mimeType - Optional MIME type hint (used only when text is not JSON)
 * @returns One-line schema sketch
 */
export function sketchJsonBody(text: string, mimeType?: string): string {
  if (text.length > 200_000) {
    return `(${formatBytes(text.length)}, too large to sketch)`
  }

  const trimmed = text.trim()
  const firstChar = trimmed[0]

  if (firstChar === '{') {
    return sketchObject(text, mimeType)
  }

  if (firstChar === '[') {
    return sketchArray(text, mimeType)
  }

  const primitive = tryPrimitive(text)
  if (primitive !== null) {
    return primitive
  }

  return formatMime(text.length, mimeType)
}

function sketchObject(text: string, mimeType?: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return formatMime(text.length, mimeType)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return formatMime(text.length, mimeType)
  }

  const keys = Object.keys(parsed)
  if (keys.length === 0) {
    return '{}'
  }

  const shown = keys.slice(0, MAX_SHOWN_KEYS).map(formatKey)

  if (keys.length <= MAX_SHOWN_KEYS) {
    return `{${shown.join(', ')}}`
  }

  const hidden = keys.length - MAX_SHOWN_KEYS
  return `{${shown.join(', ')}, …+${hidden}}`
}

function sketchArray(text: string, mimeType?: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return formatMime(text.length, mimeType)
  }

  if (!Array.isArray(parsed)) {
    return formatMime(text.length, mimeType)
  }

  if (parsed.length === 0) {
    return '[]'
  }

  const allObjects = parsed.every(
    (item) => typeof item === 'object' && item !== null && !Array.isArray(item)
  )

  if (allObjects) {
    const firstKeys = Object.keys(parsed[0])
    if (firstKeys.length === 0) {
      return `[Item] × ${parsed.length} (first: {})`
    }
    const shown = firstKeys.slice(0, MAX_SHOWN_KEYS).map(formatKey)
    if (firstKeys.length <= MAX_SHOWN_KEYS) {
      return `[Item] × ${parsed.length} (first: {${shown.join(', ')}})`
    }
    const hidden = firstKeys.length - MAX_SHOWN_KEYS
    return `[Item] × ${parsed.length} (first: {${shown.join(', ')}, …+${hidden}})`
  }

  return `[Item] × ${parsed.length}`
}

function tryPrimitive(text: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (parsed === null) return `(${formatBytes(text.length)}, null)`
  if (typeof parsed === 'boolean') return `(${formatBytes(text.length)}, boolean)`
  if (typeof parsed === 'number') return `(${formatBytes(text.length)}, number)`
  if (typeof parsed === 'string') return `(${formatBytes(text.length)}, string)`

  return null
}

function formatKey(key: string): string {
  if (key.length > MAX_KEY_LENGTH) {
    return `${key.slice(0, TRUNCATED_KEY_LENGTH)}…`
  }
  return key
}

function formatMime(len: number, mimeType?: string): string {
  if (mimeType) {
    return `(${formatBytes(len)}, ${mimeType})`
  }
  return `(${formatBytes(len)})`
}
