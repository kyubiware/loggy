/**
 * Debug logger for Loggy extension.
 * When __DEBUG__ is true (debug builds), logs are collected in a ring buffer
 * and included in Markdown exports. When false (production), all code is
 * dead-eliminated — zero overhead.
 */

declare const __DEBUG__: boolean

type DebugCategory = 'message' | 'capture' | 'storage' | 'lifecycle' | 'perf'
type DebugSource = 'background' | 'panel' | 'popup' | 'content' | 'fab'

export interface DebugEntry {
  timestamp: number
  category: DebugCategory
  source: DebugSource
  message: string
  detail?: unknown
}

const RING_BUFFER_SIZE = 500
const STORAGE_KEY = 'loggy_debug_logs'

let ringBuffer: DebugEntry[] = []

function persistBuffer(): void {
  try {
    void chrome.storage.session.set({ [STORAGE_KEY]: ringBuffer })
  } catch {
    // Storage may not be available in all contexts
  }
}

async function restoreBuffer(): Promise<void> {
  try {
    const result = (await chrome.storage.session.get(STORAGE_KEY)) as Record<string, unknown>
    const stored = result[STORAGE_KEY]
    if (Array.isArray(stored)) {
      ringBuffer = stored as DebugEntry[]
    }
  } catch {
    // Storage may not be available
  }
}

export function getDebugEntries(): DebugEntry[] {
  return [...ringBuffer]
}

export function clearDebugEntries(): void {
  ringBuffer = []
  try {
    void chrome.storage.session.remove(STORAGE_KEY)
  } catch {
    // Storage may not be available
  }
}

// Immediately restore on module load in debug mode
if (__DEBUG__) {
  void restoreBuffer()
}

export const debugLog: (
  category: DebugCategory,
  source: DebugSource,
  message: string,
  detail?: unknown
) => void = __DEBUG__
  ? (category, source, message, detail) => {
      const entry: DebugEntry = {
        timestamp: Date.now(),
        category,
        source,
        message,
        ...(detail !== undefined ? { detail } : {}),
      }
      ringBuffer.push(entry)
      if (ringBuffer.length > RING_BUFFER_SIZE) {
        ringBuffer.shift()
      }
      console.info(`[Loggy:DEBUG:${source}:${category}] ${message}`, detail ?? '')
      persistBuffer()
    }
  : (_category, _source, _message, _detail?) => {}
