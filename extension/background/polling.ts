import { getOrCreateTabState, tabStates, setTabState } from './tab-state'
import {
  readStoredEntries,
  writeStoredEntries,
  storeCapturedData,
  applyStorageLimits,
  getEntryKey,
} from './entry-storage'
import type { StoredCapturedEntry } from './entry-storage'
import { getAutoServerSync, exportTabToServer, lastExportFingerprintByTab } from './server-sync'
import type { CapturedConsoleEntry, TabCaptureState } from '../types/messages'
import { debugLog } from '../utils/debug-logger'

export const AUTO_SYNC_ALARM_NAME = 'loggy-auto-sync'
export const POLL_COUNT_KEY_PREFIX = 'loggy_poll_count_'

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
    requestBody?: string
    responseBody?: string
    contentType?: string
    duration?: number
    error?: string
  }>
}

/**
 * Returns the last polled entry count for the tab, used to compute the
 * delta between the current MAIN-world array length and what we
 * previously persisted. Defaults to 0 when unset (first poll or after
 * storage reset).
 */
export async function getPolledCount(tabId: number): Promise<number> {
  const key = `${POLL_COUNT_KEY_PREFIX}${tabId}`
  const result = (await chrome.storage.session.get(key)) as Record<string, unknown>
  return typeof result[key] === 'number' ? (result[key] as number) : 0
}

/**
 * Persists the total MAIN-world entry count observed during the most
 * recent successful poll. Used by `getPolledCount` to compute the
 * delta on the next poll.
 */
export async function setPolledCount(tabId: number, count: number): Promise<void> {
  const key = `${POLL_COUNT_KEY_PREFIX}${tabId}`
  await chrome.storage.session.set({ [key]: count })
}

/**
 * Polls the MAIN world capture arrays for a tab and auto-syncs to the
 * server when new data is detected. This is the primary data path for
 * background auto-sync when the DevTools panel is not open.
 *
 * Uses a per-tab `lastPolledCount` tracker in `chrome.storage.session`
 * to compute a delta between the current MAIN-world array length and
 * what we previously persisted. New entries are deduplicated against
 * entries already stored by the concurrent `storeCapturedData` path
 * using entry keys, then merged and written in a single batched
 * append. This preserves pre-reload entries on page reload (the
 * MAIN-world arrays reset, so the count shrinks — we reset the
 * counter to 0 and append all new entries).
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

    const consoleLogs = Array.isArray(raw.consoleLogs) ? raw.consoleLogs : []
    const networkLogs = Array.isArray(raw.networkLogs) ? raw.networkLogs : []
    const totalEntries = consoleLogs.length + networkLogs.length

    if (totalEntries === 0) {
      return
    }

    const lastCount = await getPolledCount(tabId)

    // Nothing changed since the last poll.
    if (totalEntries === lastCount) {
      debugLog('capture', 'background', `pollAndSyncTab: no new data (count unchanged, ${totalEntries} entries)`, { tabId })
      return
    }

    debugLog('capture', 'background', `pollAndSyncTab: new data detected (${totalEntries} entries, last=${lastCount})`, { tabId })

    // Convert raw entries to the stored format
    const allEntries: StoredCapturedEntry[] = []

    for (const log of consoleLogs) {
      allEntries.push({
        kind: 'console',
        entry: {
          timestamp: log.timestamp,
          level: log.level as CapturedConsoleEntry['level'],
          message: log.message,
        },
      })
    }

    for (const net of networkLogs) {
      allEntries.push({
        kind: 'network',
        entry: {
          timestamp: net.timestamp,
          url: net.url,
          method: net.method,
          status: net.status,
          requestBody: net.requestBody,
          responseBody: net.responseBody,
          contentType: net.contentType,
          duration: net.duration,
        },
      })
    }

    // Read existing stored entries (preserved across reloads by the
    // onUpdated loading guard) and build a set of their entry keys.
    const existingEntries = await readStoredEntries(tabId)
    const existingKeySet = new Set(existingEntries.map((e) => getEntryKey(e)))

    // Reload detection: if the MAIN-world array shrank, the page
    // reloaded. Reset the counter to 0 and append ALL polled entries.
    const effectiveLastCount = totalEntries < lastCount ? 0 : lastCount

    // Compute the candidate delta: the new tail of the polled arrays.
    const candidates = allEntries.slice(effectiveLastCount)

    // Deduplicate against entries already stored by the concurrent
    // `storeCapturedData` path (or by a previous poll cycle).
    const genuinelyNew = candidates.filter((entry) => !existingKeySet.has(getEntryKey(entry)))

    // Update the counter to reflect what we've now observed. Even if
    // no new entries are appended (all already in storage), we still
    // want the counter to match `totalEntries` so subsequent polls
    // correctly detect "nothing new".
    await setPolledCount(tabId, totalEntries)

    if (genuinelyNew.length === 0) {
      debugLog('capture', 'background', `pollAndSyncTab: no genuinely new entries (all already stored)`, { tabId })
      return
    }

    // Merge stored entries with the genuinely new ones, then apply caps.
    const merged = [...existingEntries, ...genuinelyNew]
    const result = await applyStorageLimits(merged)

    await writeStoredEntries(tabId, result)

    // Update tab state with new log count
    const next: TabCaptureState = {
      ...current,
      connected: true,
      logCount: result.length,
    }
    await setTabState(next)

    // Clear the export fingerprint so exportTabToServer won't skip
    lastExportFingerprintByTab.delete(tabId)

    debugLog('capture', 'background', `pollAndSyncTab: stored ${result.length} entries (${genuinelyNew.length} new), triggering export`, { tabId })
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
