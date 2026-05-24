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

  let next = [...entries, nextEntry]

  // Apply entry count cap
  if (next.length > MAX_ENTRIES_PER_TAB) {
    next = next.slice(-MAX_ENTRIES_PER_TAB)
  }

  // Apply token limit purge
  const tokenLimit = await getTokenLimit()
  if (tokenLimit > 0) {
    let totalTokens = 0
    for (const entry of next) {
      totalTokens += estimateEntryTokenCount(entry)
    }

    while (totalTokens > tokenLimit && next.length > 0) {
      const removed = next.shift()
      if (removed) {
        totalTokens -= estimateEntryTokenCount(removed)
      }
    }
  }

  await writeStoredEntries(tabId, next)
  return next.length
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
