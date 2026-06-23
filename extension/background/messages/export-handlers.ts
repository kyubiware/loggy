import {
  getStorageKeyForTab,
  getOrCreateTabState,
  setTabState,
} from '../tab-state'
import {
  readStoredEntries,
  storePanelSnapshot,
  toConsoleMessage,
  toHAREntry,
  getEntryKey,
} from '../entry-storage'
import type { StoredCapturedEntry } from '../entry-storage'
import { clearFailedExportBuffer } from '../server-sync'
import { debugLog } from '../../utils/debug-logger'
import { buildExportMarkdown } from '../../shared/export'
import { getFilteredPanelData } from '../../utils/filtered-data'
import { estimateTokenCount } from '../../utils/token-estimate'
import { browser } from '../../browser-apis'
import type { ExecutionWorld } from '../../browser-apis/types'
import type { CapturedConsoleEntry, CapturedNetworkEntry } from '../../types/capture'
import type { ConsoleMessage } from '../../types/console'
import type { HAREntry } from '../../types/har'
import {
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  createDefaultSettings,
  createInitialState,
  mergePersistedSettings,
} from '../../types/state'

/**
 * Raw MAIN-world buffer shape returned by the executeScript fallback.
 * Mirrors the shape read by polling.ts so the two paths stay aligned.
 */
interface MainWorldBuffer {
  consoleLogs: Array<{ timestamp?: unknown; level?: unknown; message?: unknown }>
  networkLogs: Array<{
    timestamp?: unknown
    url?: unknown
    method?: unknown
    status?: unknown
    requestBody?: unknown
    responseBody?: unknown
    contentType?: unknown
    duration?: unknown
  }>
}

export async function handleGetTabExportData(
  tabId: number,
  selectedRoutes?: string[],
  routesFilterEnabled?: boolean,
): Promise<{
  tokenCount: number
  markdown: string
  hasData: boolean
  logCount: number
  routeOptions: string[]
}> {
  const storedEntries = await readStoredEntries(tabId)

  // Fallback: read MAIN-world capture arrays directly. Covers the
  // Firefox service-worker cold-start case — the SW just woke up,
  // storage.session may be empty, but the page already has captures
  // buffered in window.__loggyConsoleLogs / window.__loggyNetworkLogs.
  // If this fails (tab closed, chrome:// page, no content script),
  // we silently fall back to storage-only.
  const mainWorldEntries = await readMainWorldEntries(tabId)

  // Merge: storage wins on dedup (richer data — has headers/postData/
  // timing that the MAIN-world buffer strips). Main-world only adds
  // entries that storage hasn't seen yet.
  const storedKeySet = new Set(storedEntries.map((entry) => getEntryKey(entry)))
  const newFromMainWorld = mainWorldEntries.filter((entry) => !storedKeySet.has(getEntryKey(entry)))
  const entries = [...storedEntries, ...newFromMainWorld]

  const consoleLogs: ConsoleMessage[] = []
  const networkEntries: HAREntry[] = []

  for (const stored of entries) {
    if (stored.kind === 'console') {
      consoleLogs.push(toConsoleMessage(stored.entry))
      continue
    }

    networkEntries.push(toHAREntry(stored.entry))
  }

  const defaults = createInitialState()
  const settingsResult = (await browser.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
    string,
    unknown
  >
  const persistedSettings = mergePersistedSettings(
    settingsResult[LOGGY_PANEL_SETTINGS_STORAGE_KEY],
    createDefaultSettings()
  )

  const state = {
    ...defaults,
    ...persistedSettings,
    selectedRoutes: selectedRoutes ?? defaults.selectedRoutes,
    routesFilterEnabled: routesFilterEnabled ?? defaults.routesFilterEnabled,
    consoleLogs,
    networkEntries,
  }

  const filteredData = getFilteredPanelData(state)
  const markdown = await buildExportMarkdown(state)
  const tokenCount = estimateTokenCount(markdown)

  return {
    tokenCount,
    markdown,
    hasData: filteredData.consoleLogs.length > 0 || filteredData.networkEntries.length > 0,
    logCount: filteredData.consoleLogs.length + filteredData.networkEntries.length,
    routeOptions: filteredData.routeOptions,
  }
}

/**
 * Reads the page's MAIN-world capture buffers via executeScript and
 * converts them into the storage `StoredCapturedEntry` shape. Returns
 * an empty array on any failure (tab closed, no content script,
 * permissions error, missing MAIN-world arrays) — callers can safely
 * merge the result with stored entries without a guard.
 *
 * The `func` body runs in the PAGE context, not the extension
 * TypeScript scope. Type casts on `window` inside it are necessary
 * because `__loggyConsoleLogs` / `__loggyNetworkLogs` are added by
 * console-bootstrap.mjs as untyped globals.
 */
async function readMainWorldEntries(tabId: number): Promise<StoredCapturedEntry[]> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      world: 'MAIN' as ExecutionWorld,
      func: () => ({
        consoleLogs:
          (window as unknown as Record<string, unknown>).__loggyConsoleLogs ?? [],
        networkLogs:
          (window as unknown as Record<string, unknown>).__loggyNetworkLogs ?? [],
      }),
    })

    const raw = results[0]?.result as MainWorldBuffer | undefined
    if (!raw) {
      return []
    }

    return mainWorldBufferToEntries(raw)
  } catch (error) {
    debugLog(
      'capture',
      'background',
      `readMainWorldEntries: executeScript failed`,
      { tabId, error: String(error) },
    )
    return []
  }
}

function mainWorldBufferToEntries(raw: MainWorldBuffer): StoredCapturedEntry[] {
  const consoleLogs = Array.isArray(raw.consoleLogs) ? raw.consoleLogs : []
  const networkLogs = Array.isArray(raw.networkLogs) ? raw.networkLogs : []
  const entries: StoredCapturedEntry[] = []

  for (const log of consoleLogs) {
    if (!log || typeof log !== 'object') {
      continue
    }
    const entry: CapturedConsoleEntry = {
      timestamp: typeof log.timestamp === 'string' ? log.timestamp : '',
      level:
        typeof log.level === 'string' && log.level.length > 0
          ? (log.level as CapturedConsoleEntry['level'])
          : 'log',
      message: typeof log.message === 'string' ? log.message : '',
    }
    entries.push({ kind: 'console', entry })
  }

  for (const net of networkLogs) {
    if (!net || typeof net !== 'object') {
      continue
    }
    const entry: CapturedNetworkEntry = {
      timestamp: typeof net.timestamp === 'string' ? net.timestamp : '',
      url: typeof net.url === 'string' ? net.url : '',
      method: typeof net.method === 'string' ? net.method : '',
      status: typeof net.status === 'number' ? net.status : 0,
    }
    if (typeof net.requestBody === 'string') {
      entry.requestBody = net.requestBody
    }
    if (typeof net.responseBody === 'string') {
      entry.responseBody = net.responseBody
    }
    if (typeof net.contentType === 'string') {
      entry.contentType = net.contentType
    }
    if (typeof net.duration === 'number') {
      entry.duration = net.duration
    }
    entries.push({ kind: 'network', entry })
  }

  return entries
}

/**
 * Receives a snapshot of the DevTools panel's current captured data and writes
 * it to background session storage (full per-tab replace).
 *
 * In devtools mode the panel captures directly via chrome.devtools into React
 * state and never routes through storeCapturedData, so the popup (which reads
 * exclusively from storage) would otherwise be blind to those logs. This
 * handler makes the panel's view available to the popup. Idempotent.
 */
export async function handleSyncPanelData(
  tabId: number,
  consoleLogs: ConsoleMessage[],
  networkEntries: HAREntry[],
): Promise<{ ok: true }> {
  debugLog('capture', 'background', `sync-panel-data: storing panel snapshot`, {
    tabId,
    consoleCount: consoleLogs.length,
    networkCount: networkEntries.length,
  })

  await storePanelSnapshot(tabId, consoleLogs, networkEntries)

  const current = getOrCreateTabState(tabId)
  await setTabState({ ...current, connected: true, logCount: consoleLogs.length + networkEntries.length })

  return { ok: true }
}

export async function handleClearTabData(tabId: number): Promise<{ ok: true }> {
  // Remove stored capture entries
  const key = getStorageKeyForTab(tabId)
  await browser.storage.session.remove(key)

  // Clear failed export buffer
  await clearFailedExportBuffer(tabId)

  // Reset log count in tab state
  const current = getOrCreateTabState(tabId)
  await setTabState({ ...current, logCount: 0 })

  // Clear page-level capture arrays (used by Firefox direct capture)
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const w = window as any
        if (Array.isArray(w.__loggyConsoleLogs)) {
          w.__loggyConsoleLogs.length = 0
        }
        if (Array.isArray(w.__loggyNetworkLogs)) {
          w.__loggyNetworkLogs.length = 0
        }
      },
    })
  } catch {
    // Tab may not support scripting (e.g. chrome:// pages)
  }

  return { ok: true }
}
