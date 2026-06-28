import { browser } from '../browser-apis'
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

/**
 * Reverse of {@link toHeadersMap}: rebuilds a header map from HAR headers.
 * Returns undefined for empty/missing input.
 */
export function fromHeadersMap(headers?: HARHeader[]): Record<string, string> | undefined {
  if (!headers || headers.length === 0) {
    return undefined
  }

  const map: Record<string, string> = {}
  for (const header of headers) {
    map[header.name] = header.value
  }

  return Object.keys(map).length > 0 ? map : undefined
}

/**
 * Reverse of {@link toConsoleMessage}. ConsoleMessage and CapturedConsoleEntry
 * share the same shape, so this is a direct (typed) copy.
 */
export function fromConsoleMessage(msg: ConsoleMessage): CapturedConsoleEntry {
  return {
    timestamp: msg.timestamp,
    level: msg.level,
    message: msg.message,
  }
}

/**
 * Reverse of {@link toHAREntry}: rebuilds a CapturedNetworkEntry from a HAR entry.
 */
export function fromHAREntry(har: HAREntry): CapturedNetworkEntry {
  return {
    timestamp: har.startedDateTime,
    url: har.request.url,
    method: har.request.method,
    status: har.response.status,
    requestHeaders: fromHeadersMap(har.request.headers),
    requestBody: har.request.postData?.text,
    responseHeaders: fromHeadersMap(har.response.headers),
    responseBody: har.response.content?.text,
    contentType: har.response.content?.mimeType ?? har.request.postData?.mimeType,
    duration: har.time,
  }
}

export async function readStoredEntries(tabId: number): Promise<StoredCapturedEntry[]> {
  const key = getStorageKeyForTab(tabId)
  const result = (await browser.storage.session.get(key)) as Record<string, unknown>
  const raw = result[key]

  if (!Array.isArray(raw)) {
    return []
  }

  return raw as StoredCapturedEntry[]
}

export async function writeStoredEntries(tabId: number, entries: StoredCapturedEntry[]): Promise<void> {
  const key = getStorageKeyForTab(tabId)
  await browser.storage.session.set({ [key]: entries })
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
 * Full per-tab replace driven by the DevTools panel snapshot.
 *
 * The panel captures console/network directly via browser.devtools into React
 * state (devtools mode) and never routes those captures through
 * {@link storeCapturedData}. This function lets the panel push its current
 * view into background storage so the popup (which reads exclusively from
 * storage) can see logs captured while the panel was open. Idempotent.
 */
export async function storePanelSnapshot(
  tabId: number,
  consoleLogs: ConsoleMessage[],
  networkEntries: HAREntry[],
): Promise<void> {
  const entries: StoredCapturedEntry[] = [
    ...consoleLogs.map(
      (msg): StoredCapturedEntry => ({ kind: 'console', entry: fromConsoleMessage(msg) }),
    ),
    ...networkEntries.map(
      (har): StoredCapturedEntry => ({ kind: 'network', entry: fromHAREntry(har) }),
    ),
  ]

  // Chronological order so storage-limit purging drops the oldest entries.
  entries.sort((a, b) => a.entry.timestamp.localeCompare(b.entry.timestamp))

  const limited = await applyStorageLimits(entries)
  await writeStoredEntries(tabId, limited)
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
    // seq disambiguates same-ms identical messages (e.g. repeated
    // console.error calls in a loop). The `?? ''` fallback keeps the
    // key stable for entries captured via paths that don't assign seq
    // (e.g. debugger-capture, HAR conversion).
    return `c:${e.timestamp}:${e.level}:${e.message.slice(0, 100)}:${e.seq ?? ''}`
  }
  const e = entry.entry
  // seq disambiguates same-ms parallel fetches to the same URL+method
  // (e.g. Promise.all of identical requests, retry bursts, polling
  // endpoints). Without it, two concurrent identical requests collide
  // and the second is silently dropped by polling dedup.
  return `n:${e.timestamp}:${e.url}:${e.method}:${e.seq ?? ''}`
}

export async function getTokenLimit(): Promise<number> {
  const result = (await browser.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
    string,
    unknown
  >
  const settings = result[LOGGY_PANEL_SETTINGS_STORAGE_KEY] as { maxTokenLimit?: unknown } | undefined

  if (typeof settings?.maxTokenLimit === 'number' && settings.maxTokenLimit > 0) {
    return settings.maxTokenLimit
  }

  return 0
}
