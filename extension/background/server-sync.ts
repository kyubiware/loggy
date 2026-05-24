declare const __DEBUG__: boolean
const DEBUG = __DEBUG__

import { getOrCreateTabState, getStorageKeyForTab } from './tab-state'
import { readStoredEntries, toConsoleMessage, toHAREntry } from './entry-storage'
import type { StoredCapturedEntry } from './entry-storage'
import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'
import { LOGGY_PANEL_SETTINGS_STORAGE_KEY } from '../types/state'
import { formatMarkdown } from '../utils/formatter'
import { debugLog, getDebugEntries } from '../utils/debug-logger'

export const DEFAULT_SERVER_URL = 'http://localhost:8743'
export const EXPORT_PATH = '/loggy'
export const HANDSHAKE_PATH = '/loggy/handshake'
export const FAILED_EXPORT_BUFFER_KEY_PREFIX = 'loggy_failed_export_'
export const MAX_FAILED_EXPORT_BUFFER = 20

export interface StoredPanelSettings {
  serverUrl?: string
}

export const lastExportFingerprintByTab = new Map<number, string>()

export function getFailedBufferStorageKeyForTab(tabId: number): string {
  return `${FAILED_EXPORT_BUFFER_KEY_PREFIX}${tabId}`
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export async function getServerUrl(): Promise<string> {
  const result = (await chrome.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
    string,
    unknown
  >
  const settings = result[LOGGY_PANEL_SETTINGS_STORAGE_KEY] as StoredPanelSettings | undefined

  if (typeof settings?.serverUrl === 'string' && settings.serverUrl.length > 0) {
    debugLog('message', 'background', `getServerUrl from storage: ${settings.serverUrl}`)
    return settings.serverUrl
  }

  debugLog('message', 'background', `getServerUrl using default: ${DEFAULT_SERVER_URL}`)
  return DEFAULT_SERVER_URL
}

export async function getAutoServerSync(): Promise<boolean> {
  const result = (await chrome.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
    string,
    unknown
  >
  const settings = result[LOGGY_PANEL_SETTINGS_STORAGE_KEY] as { autoServerSync?: unknown } | undefined

  const value = typeof settings?.autoServerSync === 'boolean' ? settings.autoServerSync : false
  debugLog('message', 'background', `getAutoServerSync: ${value} (raw: ${JSON.stringify(settings)})`)
  return value
}

export async function getTabUrl(tabId: number): Promise<string> {
  try {
    const tab = await chrome.tabs.get(tabId)
    return tab.url ?? 'unknown://tab'
  } catch {
    return 'unknown://tab'
  }
}

export async function buildTabMarkdown(tabId: number): Promise<string> {
  const entries = await readStoredEntries(tabId)
  const consoleLogs: ConsoleMessage[] = []
  const networkEntries: HAREntry[] = []

  for (const stored of entries) {
    if (stored.kind === 'console') {
      consoleLogs.push(toConsoleMessage(stored.entry))
      continue
    }

    networkEntries.push(toHAREntry(stored.entry))
  }

  debugLog('perf', 'background', 'Built markdown for tab', { tabId, consoleCount: consoleLogs.length, networkCount: networkEntries.length })

  return formatMarkdown({
    url: await getTabUrl(tabId),
    timestamp: new Date().toISOString(),
    includeAgentContext: true,
    includeResponseBodies: true,
    truncateConsoleLogs: true,
    consoleLogs,
    networkEntries,
    ...(DEBUG ? { debugEntries: getDebugEntries() } : {}),
  })
}

export async function appendFailedExportBuffer(tabId: number, markdown: string): Promise<void> {
  const key = getFailedBufferStorageKeyForTab(tabId)
  const result = (await chrome.storage.session.get(key)) as Record<string, unknown>
  const existingRaw = result[key]
  const existing = Array.isArray(existingRaw)
    ? (existingRaw.filter((entry) => typeof entry === 'string') as string[])
    : []

  const deduped = existing.length > 0 && existing[existing.length - 1] === markdown
  const next = deduped ? existing : [...existing, markdown]
  const bounded =
    next.length > MAX_FAILED_EXPORT_BUFFER ? next.slice(-MAX_FAILED_EXPORT_BUFFER) : next
  await chrome.storage.session.set({ [key]: bounded })
}

export async function clearFailedExportBuffer(tabId: number): Promise<void> {
  const key = getFailedBufferStorageKeyForTab(tabId)
  await chrome.storage.session.remove(key)
}

export async function pushToServer(url: string, markdown: string): Promise<boolean> {
  const fullUrl = `${normalizeBaseUrl(url)}${EXPORT_PATH}`
  debugLog('message', 'background', `pushToServer FETCHING ${fullUrl} (${markdown.length} chars)`)
  try {
    const response = await fetch(`${normalizeBaseUrl(url)}${EXPORT_PATH}`, {
      method: 'POST',
      body: markdown,
      headers: {
        'Content-Type': 'text/plain',
      },
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      debugLog('message', 'background', `Server export HTTP ${response.status} ${response.statusText}`, { status: response.status, statusText: response.statusText, url: fullUrl })
      return false
    }

    debugLog('message', 'background', `pushToServer SUCCESS ${response.status}`, { url: fullUrl })
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      debugLog('message', 'background', 'Server export TIMEOUT after 3s', { url: fullUrl })
    } else if (error instanceof TypeError) {
      debugLog('message', 'background', `Server export NETWORK ERROR: ${error.message}`, { url: fullUrl })
    } else {
      debugLog('message', 'background', 'Server export FAILED', { error, url: fullUrl })
    }

    return false
  }
}

export async function probeServerFromBackground(url: string): Promise<boolean> {
  try {
    const handshakeUrl = `${normalizeBaseUrl(url)}${HANDSHAKE_PATH}`
    console.log('[Loggy:bg] probeServerFromBackground fetching:', handshakeUrl)
    debugLog('message', 'background', `probeServerFromBackground fetching: ${handshakeUrl}`)
    const response = await fetch(handshakeUrl, {
      signal: AbortSignal.timeout(1000),
    })

    if (!response.ok) {
      console.log('[Loggy:bg] probeServerFromBackground got non-ok status:', response.status)
      debugLog('message', 'background', `probeServerFromBackground non-ok status: ${response.status}`)
      return false
    }

    const data = (await response.json()) as { name?: unknown }
    const result = data.name === 'loggy-serve'
    console.log('[Loggy:bg] probeServerFromBackground result:', result, 'data:', data)
    debugLog('message', 'background', `probeServerFromBackground result: ${result}`)
    return result
  } catch (error) {
    console.error('[Loggy:bg] probeServerFromBackground error:', error)
    debugLog('message', 'background', 'probeServerFromBackground error', { error })
    return false
  }
}

export async function exportTabToServer(tabId: number): Promise<boolean> {
  console.log('[Loggy:bg] exportTabToServer called for tabId:', tabId)
  debugLog('message', 'background', `exportTabToServer called for tabId: ${tabId}`)
  const entries = await readStoredEntries(tabId)

  // Build a content fingerprint from stored entries (excludes timestamp)
  const fingerprint = JSON.stringify(entries)

  if (fingerprint === lastExportFingerprintByTab.get(tabId)) {
    debugLog('message', 'background', `exportTabToServer SKIPPED: fingerprint unchanged (${entries.length} entries)`, { tabId })
    return true
  }

  const entryCount = entries.length
  console.log('[Loggy:bg] exportTabToServer EXPORTING: new fingerprint for tabId:', tabId, 'entries:', entryCount)
  debugLog('message', 'background', `exportTabToServer EXPORTING: tabId: ${tabId}, entries: ${entryCount}`)
  const markdown = await buildTabMarkdown(tabId)
  const serverUrl = await getServerUrl()
  const success = await pushToServer(serverUrl, markdown)

  if (success) {
    lastExportFingerprintByTab.set(tabId, fingerprint)
    await clearFailedExportBuffer(tabId)
    debugLog('message', 'background', `exportTabToServer SUCCEEDED for tabId: ${tabId}`)
    return true
  }

  await appendFailedExportBuffer(tabId, markdown)
  debugLog('message', 'background', `exportTabToServer FAILED for tabId: ${tabId} - buffered for retry`)
  return false
}
