import {
  getStorageKeyForTab,
  getOrCreateTabState,
  setTabState,
} from '../tab-state'
import { readStoredEntries, toConsoleMessage, toHAREntry } from '../entry-storage'
import { clearFailedExportBuffer } from '../server-sync'
import { buildExportMarkdown } from '../../shared/export'
import { getFilteredPanelData } from '../../utils/filtered-data'
import { estimateTokenCount } from '../../utils/token-estimate'
import type { ConsoleMessage } from '../../types/console'
import type { HAREntry } from '../../types/har'
import {
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  createDefaultSettings,
  createInitialState,
  mergePersistedSettings,
} from '../../types/state'

export async function handleGetTabExportData(
  tabId: number,
  selectedRoutes?: string[],
): Promise<{
  tokenCount: number
  markdown: string
  hasData: boolean
  logCount: number
  routeOptions: string[]
}> {
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

  const defaults = createInitialState()
  const settingsResult = (await chrome.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
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

export async function handleClearTabData(tabId: number): Promise<{ ok: true }> {
  // Remove stored capture entries
  const key = getStorageKeyForTab(tabId)
  await chrome.storage.session.remove(key)

  // Clear failed export buffer
  await clearFailedExportBuffer(tabId)

  // Reset log count in tab state
  const current = getOrCreateTabState(tabId)
  await setTabState({ ...current, logCount: 0 })

  // Clear page-level capture arrays (used by Firefox direct capture)
  try {
    await chrome.scripting.executeScript({
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
