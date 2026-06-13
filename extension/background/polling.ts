import { getOrCreateTabState, tabStates, setTabState } from './tab-state'
import {
  readStoredEntries,
  writeStoredEntries,
  storeCapturedData,
  MAX_ENTRIES_PER_TAB,
} from './entry-storage'
import type { StoredCapturedEntry } from './entry-storage'
import { getAutoServerSync, exportTabToServer, lastExportFingerprintByTab } from './server-sync'
import type { CapturedConsoleEntry, TabCaptureState } from '../types/messages'
import { debugLog } from '../utils/debug-logger'

export const AUTO_SYNC_ALARM_NAME = 'loggy-auto-sync'
export const POLL_FINGERPRINT_KEY_PREFIX = 'loggy_poll_fp_'

/**
 * Raw data shape returned from the MAIN world capture arrays.
 */
export interface RawBufferData {
  consoleLogs: Array<{ timestamp: string; level: string; message: string }>
  networkLogs: Array<{
    timestamp: string
    url: string
    method: string
    status: number
    responseBody?: string
    contentType?: string
    duration?: number
    error?: string
  }>
}

export async function getPollFingerprint(tabId: number): Promise<string> {
  const key = `${POLL_FINGERPRINT_KEY_PREFIX}${tabId}`
  const result = (await chrome.storage.session.get(key)) as Record<string, unknown>
  return typeof result[key] === 'string' ? (result[key] as string) : ''
}

export async function setPollFingerprint(tabId: number, fingerprint: string): Promise<void> {
  const key = `${POLL_FINGERPRINT_KEY_PREFIX}${tabId}`
  await chrome.storage.session.set({ [key]: fingerprint })
}

export async function restorePollFingerprints(): Promise<void> {
  // Fingerprints are stored individually in chrome.storage.session
  // keyed by POLL_FINGERPRINT_KEY_PREFIX + tabId. They are read on demand
  // by getPollFingerprint, so no bulk restore is needed.
}

/**
 * Polls the MAIN world capture arrays for a tab and auto-syncs to the
 * server when new data is detected. This is the primary data path for
 * background auto-sync when the DevTools panel is not open.
 */
export async function pollAndSyncTab(tabId: number): Promise<void> {
  const current = getOrCreateTabState(tabId)

  // Only poll tabs in content-script or debugger mode that aren't
  // managed by the DevTools panel.
  if (current.mode === 'devtools' || current.mode === 'inactive') {
    return
  }

  // Skip if auto-sync is disabled
  const autoSync = await getAutoServerSync()
  if (!autoSync) {
    return
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN' as chrome.scripting.ExecutionWorld,
      func: () => ({
        consoleLogs: (window as unknown as Record<string, unknown[]>).__loggyConsoleLogs || [],
        networkLogs: (window as unknown as Record<string, unknown[]>).__loggyNetworkLogs || [],
      }),
    })

    const raw = results[0]?.result as RawBufferData | undefined
    if (!raw) {
      return
    }

    if (!Array.isArray(raw.consoleLogs) && !Array.isArray(raw.networkLogs)) {
      return
    }

    // Compute a lightweight fingerprint from the raw arrays.
    // Only hash the length + last entry to avoid O(n) serialization on every poll.
    const consoleLogs = Array.isArray(raw.consoleLogs) ? raw.consoleLogs : []
    const networkLogs = Array.isArray(raw.networkLogs) ? raw.networkLogs : []
    const totalEntries = consoleLogs.length + networkLogs.length

    if (totalEntries === 0) {
      return
    }

    const fingerprint = `${totalEntries}:${consoleLogs.length > 0 ? JSON.stringify(consoleLogs[consoleLogs.length - 1]) : ''}:${networkLogs.length > 0 ? JSON.stringify(networkLogs[networkLogs.length - 1]) : ''}`
    const lastFingerprint = await getPollFingerprint(tabId)

    if (fingerprint === lastFingerprint) {
      debugLog('capture', 'background', `pollAndSyncTab: no new data (fingerprint unchanged, ${totalEntries} entries)`, { tabId })
      return
    }

    debugLog('capture', 'background', `pollAndSyncTab: new data detected (${totalEntries} entries)`, { tabId })

    // Convert raw entries to the stored format and replace stored data
    const storedEntries: StoredCapturedEntry[] = []

    for (const log of consoleLogs) {
      storedEntries.push({
        kind: 'console',
        entry: {
          timestamp: log.timestamp,
          level: log.level as CapturedConsoleEntry['level'],
          message: log.message,
        },
      })
    }

    for (const net of networkLogs) {
      storedEntries.push({
        kind: 'network',
        entry: {
          timestamp: net.timestamp,
          url: net.url,
          method: net.method,
          status: net.status,
          responseBody: net.responseBody,
          contentType: net.contentType,
          duration: net.duration,
        },
      })
    }

    // Cap to MAX_ENTRIES_PER_TAB (keep the latest)
    const capped = storedEntries.length > MAX_ENTRIES_PER_TAB
      ? storedEntries.slice(-MAX_ENTRIES_PER_TAB)
      : storedEntries

    await writeStoredEntries(tabId, capped)

    // Update tab state with new log count
    const next: TabCaptureState = {
      ...current,
      connected: true,
      logCount: capped.length,
    }
    await setTabState(next)

    // Persist the poll fingerprint
    await setPollFingerprint(tabId, fingerprint)

    // Clear the export fingerprint so exportTabToServer won't skip
    lastExportFingerprintByTab.delete(tabId)

    debugLog('capture', 'background', `pollAndSyncTab: stored ${capped.length} entries, triggering export`, { tabId })
    await exportTabToServer(tabId)
  } catch (error) {
    debugLog('capture', 'background', `pollAndSyncTab: executeScript failed`, { tabId, error: String(error) })
  }
}

/**
 * Iterates all active tabs in content-script mode and polls each one.
 */
export async function pollAllActiveTabs(): Promise<void> {
  const autoSync = await getAutoServerSync()
  if (!autoSync) {
    return
  }

  for (const [tabId, state] of tabStates.entries()) {
    if (state.mode === 'content-script' || state.mode === 'debugger') {
      await pollAndSyncTab(tabId)
    }
  }
}
