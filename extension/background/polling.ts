import { browser } from '../browser-apis'
import type { ExecutionWorld } from '../browser-apis/types'
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
import type { CapturedConsoleEntry, CapturedNetworkEntry, TabCaptureState } from '../types/messages'
import { debugLog } from '../utils/debug-logger'

export const AUTO_SYNC_ALARM_NAME = 'loggy-auto-sync'

/**
 * Raw data shape returned from the MAIN world capture arrays.
 *
 * The optional `seq` field is a per-frame monotonic counter assigned by
 * console-bootstrap.mjs at capture time. It disambiguates entries that
 * share timestamp+url+method (parallel fetches, retries) and entries
 * that share timestamp+level+message (repeated identical console
 * calls), so the background dedup key never collapses distinct
 * captures into one.
 */
export interface RawBufferData {
  consoleLogs: Array<{ timestamp: string; level: string; message: string; seq?: number }>
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
    seq?: number
  }>
}

/**
 * Polls the MAIN world capture arrays for a tab and auto-syncs to the
 * server when new data is detected. This is the primary data path for
 * background auto-sync when the DevTools panel is not open.
 *
 * Every poll compares the FULL current MAIN-world snapshot against the
 * entries already persisted for the tab, and appends only those whose
 * `getEntryKey` is not already present. This is O(N) per poll (N ≤
 * 1500 — 1000 console + 500 network ring-buffer cap) and is correct
 * under the ring-buffer `.shift()` eviction in the bootstrap, which
 * earlier index-based delta schemes were not.
 *
 * Dedup is the single source of truth: the per-entry key now embeds a
 * monotonic `seq` counter (see console-bootstrap.mjs), so concurrent
 * identical requests and repeated identical console messages no longer
 * collapse into a single stored entry. The export fingerprint
 * (`lastExportFingerprintByTab`) prevents redundant server pushes when
 * nothing has changed.
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
    const results = await browser.scripting.executeScript({
      target: { tabId },
      world: 'MAIN' as ExecutionWorld,
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

    if (consoleLogs.length === 0 && networkLogs.length === 0) {
      return
    }

    // Convert raw entries to the stored format. `seq` flows through
    // from the MAIN-world bootstrap; entries from paths that don't
    // assign seq get `undefined`, which `getEntryKey` handles via the
    // `?? ''` fallback.
    const polled: StoredCapturedEntry[] = []

    for (const log of consoleLogs) {
      const entry: CapturedConsoleEntry = {
        timestamp: log.timestamp,
        level: log.level as CapturedConsoleEntry['level'],
        message: log.message,
      }
      if (typeof log.seq === 'number') {
        entry.seq = log.seq
      }
      polled.push({ kind: 'console', entry })
    }

    for (const net of networkLogs) {
      const entry: CapturedNetworkEntry = {
        timestamp: net.timestamp,
        url: net.url,
        method: net.method,
        status: net.status,
        requestBody: net.requestBody,
        responseBody: net.responseBody,
        contentType: net.contentType,
        duration: net.duration,
      }
      if (typeof net.seq === 'number') {
        entry.seq = net.seq
      }
      polled.push({ kind: 'network', entry })
    }

    // Read existing stored entries (preserved across reloads by the
    // onUpdated loading guard) and build a set of their entry keys.
    const existingEntries = await readStoredEntries(tabId)
    const existingKeySet = new Set(existingEntries.map((e) => getEntryKey(e)))

    // Deduplicate against entries already stored by the concurrent
    // `storeCapturedData` path or by a previous poll cycle. Comparing
    // the full polled set (rather than an index-based delta tail)
    // survives the bootstrap ring-buffer `.shift()` eviction — see
    // Bug B regression test in auto-sync.test.ts.
    const genuinelyNew = polled.filter((entry) => !existingKeySet.has(getEntryKey(entry)))

    if (genuinelyNew.length === 0) {
      debugLog('capture', 'background', `pollAndSyncTab: no genuinely new entries (${polled.length} polled, ${existingEntries.length} stored)`, { tabId })
      return
    }

    debugLog('capture', 'background', `pollAndSyncTab: ${genuinelyNew.length} new of ${polled.length} polled (${existingEntries.length} stored)`, { tabId })

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
