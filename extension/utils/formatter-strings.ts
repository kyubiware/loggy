/**
 * Shared text helpers for Markdown formatting.
 */

/**
 * Converts bytes to human-readable format
 * @param bytes - Number of bytes to format
 * @returns Formatted string with appropriate unit (B, KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * Truncates long strings with indicator on its own line.
 * @param str - String to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string with byte-count indicator on its own line, or original if within limit
 */
export function truncate(str: string, maxLength: number): string {
  if (!str) return ''
  if (str.length <= maxLength) return str
  return `${str.substring(0, maxLength)}\n… [truncated, showed ${maxLength} of ${str.length} bytes]`
}

/**
 * Truncates a JSON string at a structurally safe boundary (closed container or
 * separator) and emits a C-style block-comment marker on its own line.
 *
 * Uses a hand-rolled scanner (not JSON.parse) so it can handle malformed or
 * truncated JSON without throwing. Iterates codepoints (not UTF-16 code units)
 * to avoid splitting surrogate pairs.
 *
 * Falls through to {@link truncate} when the input does not look like JSON
 * (trimmed first char is not `{` or `[`).
 *
 * @param text - JSON string to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated JSON with byte-count marker, or original if within limit
 */
export function truncateJSON(text: string, maxLength: number): string {
  if (!text) return ''
  if (text.length <= maxLength) return text
  if (!looksLikeJSON(text)) return truncate(text, maxLength)

  const scan = scanJSON(text, maxLength)
  if (scan.safePos > 0) {
    return emit(text, scan.safePos, scan.safeClosing)
  }
  return emit(text, maxLength, closingFor(scan.stackAtCut))
}

/**
 * Returns true when the trimmed input starts with `{` or `[`, the most
 * common signal that we're looking at a JSON object or array.
 */
function looksLikeJSON(text: string): boolean {
  const trimmed = text.trimStart()
  if (trimmed.length === 0) return false
  const first = trimmed[0]
  return first === '{' || first === '['
}

interface ScanResult {
  safePos: number
  safeClosing: string
  /** Stack of open containers AT the cut point (`safePos` or `maxLength`). */
  stackAtCut: ('{' | '[')[]
}

/**
 * Scans `text` once with a hand-rolled JSON scanner, tracking container depth,
 * string state, and key/value alternation. Returns the latest "safe cut"
 * position at or before `maxLength` together with the closing-bracket run
 * needed to balance the open containers.
 */
function scanJSON(text: string, maxLength: number): ScanResult {
  const codepoints = Array.from(text)
  const stack: ('{' | '[')[] = []
  // Snapshot of the stack at the cut point (safe cut OR `maxLength`).
  // Cloned so it survives later mutations of `stack` during the scan.
  let stackAtCut: ('{' | '[')[] = []
  let stackAtCutSet = false
  const state: ScanState = {
    depth: 0,
    inString: false,
    escapeNext: false,
    expectingKey: false,
    currentStringIsKey: false,
    safePos: 0,
    safeClosing: '',
  }
  let utf16Pos = 0

  for (let i = 0; i < codepoints.length; i++) {
    const ch = codepoints[i]
    const pos = utf16Pos + ch.length

    if (!stackAtCutSet && pos >= maxLength) {
      stackAtCut = [...stack]
      stackAtCutSet = true
    }

    step(ch, pos, utf16Pos, state, stack, maxLength)
    utf16Pos = pos
  }

  // Fallback: never crossed maxLength (caller guards against this, but be safe).
  if (!stackAtCutSet) stackAtCut = [...stack]
  return { safePos: state.safePos, safeClosing: state.safeClosing, stackAtCut }
}

interface ScanState {
  depth: number
  inString: boolean
  escapeNext: boolean
  expectingKey: boolean
  currentStringIsKey: boolean
  safePos: number
  safeClosing: string
}

function step(
  ch: string,
  pos: number,
  beforePos: number,
  state: ScanState,
  stack: ('{' | '[')[],
  maxLength: number
): void {
  if (state.inString) {
    if (state.escapeNext) {
      state.escapeNext = false
    } else if (ch === '\\') {
      state.escapeNext = true
    } else if (ch === '"') {
      state.inString = false
      if (state.depth >= 1 && !state.currentStringIsKey && pos <= maxLength) {
        state.safePos = pos
        state.safeClosing = closingFor(stack)
      }
    }
    return
  }

  switch (ch) {
    case '"':
      state.inString = true
      state.escapeNext = false
      state.currentStringIsKey = state.expectingKey
      return
    case '{':
    case '[':
      state.depth++
      stack.push(ch)
      state.expectingKey = ch === '{'
      return
    case '}':
    case ']':
      if (state.depth >= 1) {
        state.depth--
        stack.pop()
        if (pos <= maxLength) {
          state.safePos = pos
          state.safeClosing = closingFor(stack)
        }
      } else {
        state.depth--
        stack.pop()
      }
      state.expectingKey = false
      return
    case ',':
      if (state.depth >= 1 && beforePos <= maxLength) {
        state.safePos = beforePos
        state.safeClosing = closingFor(stack)
      }
      state.expectingKey = stack.length > 0 && stack[stack.length - 1] === '{'
      return
    case ':':
      state.expectingKey = false
      return
    default:
      return
  }
}

function emit(text: string, pos: number, closing: string): string {
  return `${text.slice(0, pos)}${closing}\n… /* truncated: showed ${pos} of ${text.length} bytes */`
}

/**
 * Builds the closing-bracket string for the currently-open containers,
 * innermost first. `['[', '{']` becomes `}`.
 */
function closingFor(stack: ('{' | '[')[]): string {
  let out = ''
  for (let i = stack.length - 1; i >= 0; i--) {
    out += stack[i] === '{' ? '}' : ']'
  }
  return out
}

/**
 * Escapes special Markdown characters for safe rendering
 * @param text - Text to escape
 * @returns Escaped text safe for Markdown
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/`/g, '\\`').replace(/\*/g, '\\*')
}

/**
 * Formats the relative offset of an ISO timestamp from a session anchor
 * (the earliest observed timestamp in the export).
 *
 * Returns an empty string when no anchor is available or the ISO is malformed,
 * so a single bad timestamp can never poison the rest of the output with
 * `NaNms` markers. Negative deltas are clamped to 0.
 *
 * @param iso - ISO 8601 timestamp
 * @param anchorMs - Epoch milliseconds of the session anchor (earliest event)
 * @returns Offset string like `t+250ms`, `t+1.2s`, `t+3m`, or '' when unusable
 */
export function formatRelativeOffset(iso: string, anchorMs: number | undefined): string {
  if (anchorMs === undefined) return ''
  const eventMs = Date.parse(iso)
  if (Number.isNaN(eventMs)) return ''
  const rawDelta = eventMs - anchorMs
  const delta = rawDelta < 0 ? 0 : rawDelta
  if (delta < 1000) return `t+${delta}ms`
  if (delta < 60_000) {
    const s = (delta / 1000).toFixed(1).replace(/\.0$/, '')
    return `t+${s}s`
  }
  const m = (delta / 60_000).toFixed(1).replace(/\.0$/, '')
  return `t+${m}m`
}
