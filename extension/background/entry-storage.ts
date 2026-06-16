import { STORAGE_KEY_PREFIX, getStorageKeyForTab } from './tab-state'
import type { CapturedConsoleEntry, CapturedNetworkEntry, CaptureMessage } from '../types/messages'
import type { ConsoleMessage } from '../types/console'
import type { HAREntry, HARHeader } from '../types/har'
import { LOGGY_PANEL_SETTINGS_STORAGE_KEY } from '../types/state'
import { estimateEntryTokenCount } from '../utils/token-estimate'

export const MAX_ENTRIES_PER_TAB = 1000

export type StoredCapturedEntry =
  | { kind: 'console'; entry: CapturedConsoleEntry }
  | { kind: 'network'; entry: CapturedNetworkEntry }

export function toHeadersMap(headers?: Record<string, string>): HARHeader[] | undefined {
  if (!headers) {
    return undefined
  }

  const mapped = Object.entries(headers).map(([name, value]) => ({ name, value }))
  return mapped.length > 0 ? mapped : undefined
}

export function toConsoleMessage(entry: CapturedConsoleEntry): ConsoleMessage {
  return {
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
  }
}

export function toHAREntry(entry: CapturedNetworkEntry): HAREntry {
  return {
    startedDateTime: entry.timestamp,
    time: entry.duration,
    request: {
      url: entry.url,
      method: entry.method,
      headers: toHeadersMap(entry.requestHeaders),
      postData:
        typeof entry.requestBody === 'string'
          ? {
              text: entry.requestBody,
              mimeType: entry.contentType,
            }
          : undefined,
    },
    response: {
      status: entry.status,
      statusText: '',
      headers: toHeadersMap(entry.responseHeaders),
      content:
        typeof entry.responseBody === 'string' || typeof entry.contentType === 'string'
          ? {
              text: entry.responseBody,
              mimeType: entry.contentType,
            }
          : undefined,
    },
  }
}

export async function readStoredEntries(tabId: number): Promise<StoredCapturedEntry[]> {
  const key = getStorageKeyForTab(tabId)
  const result = (await chrome.storage.session.get(key)) as Record<string, unknown>
  const raw = result[key]

  if (!Array.isArray(raw)) {
    return []
  }

  return raw as StoredCapturedEntry[]
}

export async function writeStoredEntries(tabId: number, entries: StoredCapturedEntry[]): Promise<void> {
  const key = getStorageKeyForTab(tabId)
  await chrome.storage.session.set({ [key]: entries })
}

export async function storeCapturedData(tabId: number, data: CaptureMessage): Promise<number> {
  const entries = await readStoredEntries(tabId)
  const nextEntry: StoredCapturedEntry =
    data.source === 'console'
      ? { kind: 'console', entry: data.payload as CapturedConsoleEntry }
      : { kind: 'network', entry: data.payload as CapturedNetworkEntry }

  const next = await applyStorageLimits([...entries, nextEntry])

  await writeStoredEntries(tabId, next)
  return next.length
}

/**
 * Applies the entry-count cap and the optional token-limit purge to an
 * in-memory array of stored entries. Pure aside from reading the
 * configured token limit from settings; returns a new array (never
 * mutates the input).
 */
export async function applyStorageLimits(entries: StoredCapturedEntry[]): Promise<StoredCapturedEntry[]> {
  let result = entries
  if (result.length > MAX_ENTRIES_PER_TAB) {
    result = result.slice(-MAX_ENTRIES_PER_TAB)
  }

  const tokenLimit = await getTokenLimit()
  if (tokenLimit <= 0) {
    return result
  }

  let totalTokens = 0
  for (const entry of result) {
    totalTokens += estimateEntryTokenCount(entry)
  }

  let working = result
  while (totalTokens > tokenLimit && working.length > 0) {
    const removed = working[0]
    working = working.slice(1)
    if (removed) {
      totalTokens -= estimateEntryTokenCount(removed)
    }
  }
  return working
}

/**
 * Deterministic key used to deduplicate stored entries across writers
 * (per-message `storeCapturedData` and the polling delta-append path).
 * The key combines a kind prefix with stable fields the two writers
 * always see identically for the same event.
 */
export function getEntryKey(entry: StoredCapturedEntry): string {
  if (entry.kind === 'console') {
    const e = entry.entry
    return `c:${e.timestamp}:${e.level}:${e.message.slice(0, 100)}`
  }
  const e = entry.entry
  return `n:${e.timestamp}:${e.url}:${e.method}`
}

export async function getTokenLimit(): Promise<number> {
  const result = (await chrome.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
    string,
    unknown
  >
  const settings = result[LOGGY_PANEL_SETTINGS_STORAGE_KEY] as { maxTokenLimit?: unknown } | undefined

  if (typeof settings?.maxTokenLimit === 'number' && settings.maxTokenLimit > 0) {
    return settings.maxTokenLimit
  }

  return 0
}
