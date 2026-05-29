import { useCallback, useEffect, useRef } from 'react'
import { browser } from '../../../browser-apis/index.js'
import { debugLog } from '../../../utils/debug-logger'
import type { ConsoleMessage } from '../../../types/console'
import type { HAREntry } from '../../../types/har'
import {
  createInitialState,
  extractPersistedSettings,
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  type LoggyState,
  mergePersistedSettings,
  type PersistedLoggySettings,
} from '../../../types/state'
import {
  captureConsoleLogs,
  captureNetworkEntries,
  clearCapturedConsoleLogs,
  clearResponseBodies,
  enrichWithResponseBodies,
  notifyPanelClosed,
  notifyPanelOpened,
  startResponseBodyCapture,
  stopResponseBodyCapture,
} from '../../capture'
import type { Action } from './useCaptureData'

const AUTO_REFRESH_INTERVAL_MS = 2000

function isAfterCutoff(entry: HAREntry, cutoffMs: number | null): boolean {
  if (cutoffMs === null) return true
  const entryTimeMs = Date.parse(entry.startedDateTime)
  if (Number.isNaN(entryTimeMs)) return false
  return entryTimeMs > cutoffMs
}

function useHydrationEffect(
  dispatch: React.Dispatch<Action>,
  hydrationCompleteRef: React.MutableRefObject<boolean>,
  probeConfiguredServer: (url: string) => Promise<void>,
  markUrlProbed: (url: string) => void
): void {
  const defaultsRef = useRef(createInitialState())

  const handleStorageResult = useCallback(
    (result: Partial<Record<string, unknown>>): void => {
      const defaults = defaultsRef.current
      const mergedSettings = mergePersistedSettings(result[LOGGY_PANEL_SETTINGS_STORAGE_KEY], {
        consoleFilter: defaults.consoleFilter,
        networkFilter: defaults.networkFilter,
        consoleVisible: defaults.consoleVisible,
        networkVisible: defaults.networkVisible,
        includeAgentContext: defaults.includeAgentContext,
        includeResponseBodies: defaults.includeResponseBodies,
        truncateConsoleLogs: defaults.truncateConsoleLogs,
        truncateResponseBodies: defaults.truncateResponseBodies,
        redactSensitiveInfo: defaults.redactSensitiveInfo,
        networkExportEnabled: defaults.networkExportEnabled,
        autoServerSync: defaults.autoServerSync,
        serverUrl: defaults.serverUrl,
        settingsAccordionOpen: defaults.settingsAccordionOpen,
        filtersAccordionOpen: defaults.filtersAccordionOpen,
        maxTokenLimit: defaults.maxTokenLimit,
        deduplicateApiCalls: defaults.deduplicateApiCalls,
        preserveLogs: defaults.preserveLogs,
      })

      if (result[LOGGY_PANEL_SETTINGS_STORAGE_KEY] !== undefined) {
        dispatch({
          type: 'HYDRATE_SETTINGS',
          settings: result[LOGGY_PANEL_SETTINGS_STORAGE_KEY] as PersistedLoggySettings,
        })
      }

      hydrationCompleteRef.current = true
      markUrlProbed(mergedSettings.serverUrl)
      void probeConfiguredServer(mergedSettings.serverUrl)
    },
    [dispatch, probeConfiguredServer, hydrationCompleteRef, markUrlProbed]
  )

  useEffect(() => {
    let cancelled = false
    try {
      browser.storage.local.get(
        [LOGGY_PANEL_SETTINGS_STORAGE_KEY],
        (result: Partial<Record<string, unknown>>) => {
          if (!cancelled) handleStorageResult(result)
        }
      )
    } catch (error) {
      console.error('Failed to hydrate persisted Loggy panel settings:', error)
      hydrationCompleteRef.current = true
      if (!cancelled) void probeConfiguredServer(defaultsRef.current.serverUrl)
    }
    return () => {
      cancelled = true
    }
  }, [handleStorageResult, probeConfiguredServer, hydrationCompleteRef])
}

function usePersistenceEffect(
  state: LoggyState,
  hydrationCompleteRef: React.MutableRefObject<boolean>
): void {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persistedSettings = extractPersistedSettings(state)

  useEffect(() => {
    if (!hydrationCompleteRef.current) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(() => {
      browser.storage.local.set({ [LOGGY_PANEL_SETTINGS_STORAGE_KEY]: persistedSettings })
    }, 300)

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [persistedSettings, hydrationCompleteRef])
}

function useLifecycleEffect(
  captureData: () => Promise<void>,
  startAutoRefresh: () => void,
  stopAutoRefresh: () => void,
  dispatch: React.Dispatch<Action>,
  latestStateRef: React.MutableRefObject<LoggyState>,
  preservedConsoleLogsRef: React.MutableRefObject<ConsoleMessage[]>,
  networkClearCutoffMs: React.MutableRefObject<number | null>
): void {
  useEffect(() => {
    startResponseBodyCapture()
    const inspectedTabId = chrome.devtools.inspectedWindow.tabId
    if (typeof inspectedTabId === 'number') notifyPanelOpened(inspectedTabId)
    void captureData()
    if (document.visibilityState === 'visible') startAutoRefresh()

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        startAutoRefresh()
        void captureData()
        return
      }
      stopAutoRefresh()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const handleNavigated = (): void => {
      const preserveLogs = latestStateRef.current.preserveLogs
      debugLog('lifecycle', 'panel', `onNavigated fired: preserveLogs=${preserveLogs}`, {
        consoleLogCount: latestStateRef.current.consoleLogs.length,
        networkEntryCount: latestStateRef.current.networkEntries.length,
        existingPreservedCount: preservedConsoleLogsRef.current.length,
        networkClearCutoffMs: networkClearCutoffMs.current,
      })

      if (preserveLogs) {
        preservedConsoleLogsRef.current = latestStateRef.current.consoleLogs
        networkClearCutoffMs.current = null
        debugLog('lifecycle', 'panel', `onNavigated: PRESERVING ${preservedConsoleLogsRef.current.length} console logs, networkCutoff=null`, {
          preservedCount: preservedConsoleLogsRef.current.length,
        })
        return
      }

      debugLog('lifecycle', 'panel', 'onNavigated: CLEARING data (preserveLogs=false)')
      dispatch({ type: 'RESET_DATA' })
      networkClearCutoffMs.current = null
      clearResponseBodies()
    }
    browser.devtools.network.onNavigated.addListener(handleNavigated)

    return () => {
      if (typeof inspectedTabId === 'number') notifyPanelClosed(inspectedTabId)
      stopAutoRefresh()
      stopResponseBodyCapture()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      browser.devtools.network.onNavigated.removeListener(handleNavigated)
    }
  }, [
    captureData,
    startAutoRefresh,
    stopAutoRefresh,
    dispatch,
    latestStateRef,
    preservedConsoleLogsRef,
    networkClearCutoffMs,
  ])
}

/**
 * Manages data capture, persistence, and panel lifecycle for the Loggy panel.
 */
export function useDataCapabilities(
  dispatch: React.Dispatch<Action>,
  state: LoggyState,
  probeConfiguredServer: (configuredServerUrl: string) => Promise<void>,
  hydrationCompleteRef: React.MutableRefObject<boolean>,
  markUrlProbed: (url: string) => void
): {
  captureData: () => Promise<void>
  clearData: () => Promise<void>
  latestStateRef: React.MutableRefObject<LoggyState>
} {
  const isCapturing = useRef(false)
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const networkClearCutoffMs = useRef<number | null>(null)
  const preservedConsoleLogsRef = useRef<ConsoleMessage[]>([])
  const latestStateRef = useRef(state)
  const filterNetworkEntriesAfterClear = useCallback(
    (entries: HAREntry[]): HAREntry[] =>
      entries.filter((e) => isAfterCutoff(e, networkClearCutoffMs.current)),
    []
  )
  const captureData = useCallback(async (): Promise<void> => {
    if (isCapturing.current) return
    isCapturing.current = true
    try {
      const rawEntries = await captureNetworkEntries()
      const networkEntries = enrichWithResponseBodies(filterNetworkEntriesAfterClear(rawEntries))
      let consoleLogs = await captureConsoleLogs()

      debugLog('capture', 'panel', `captureData: raw capture complete`, {
        capturedConsoleLogs: consoleLogs.length,
        capturedNetworkEntries: networkEntries.length,
        rawNetworkEntries: rawEntries.length,
        networkClearCutoffMs: networkClearCutoffMs.current,
        pendingPreservedCount: preservedConsoleLogsRef.current.length,
        preserveLogs: latestStateRef.current.preserveLogs,
      })

      if (preservedConsoleLogsRef.current.length > 0) {
        const prevCount = consoleLogs.length
        consoleLogs = [...preservedConsoleLogsRef.current, ...consoleLogs]
        debugLog('capture', 'panel', `captureData: MERGED preserved logs`, {
          preservedCount: preservedConsoleLogsRef.current.length,
          newCount: prevCount,
          totalCount: consoleLogs.length,
        })
        preservedConsoleLogsRef.current = []
      }
      dispatch({ type: 'SET_DATA', consoleLogs, networkEntries })
    } catch (error) {
      console.error('Error capturing data:', error)
    } finally {
      isCapturing.current = false
    }
  }, [filterNetworkEntriesAfterClear, dispatch])
  const clearData = useCallback(async (): Promise<void> => {
    debugLog('lifecycle', 'panel', 'clearData: manual clear requested', {
      consoleLogCount: latestStateRef.current.consoleLogs.length,
      networkEntryCount: latestStateRef.current.networkEntries.length,
      preserveLogs: latestStateRef.current.preserveLogs,
    })
    dispatch({ type: 'RESET_DATA' })
    networkClearCutoffMs.current = Date.now()
    await clearCapturedConsoleLogs()
  }, [dispatch])
  const startAutoRefresh = useCallback((): void => {
    if (autoRefreshTimer.current !== null) return
    autoRefreshTimer.current = setInterval(() => {
      void captureData()
    }, AUTO_REFRESH_INTERVAL_MS)
  }, [captureData])
  const stopAutoRefresh = useCallback((): void => {
    if (autoRefreshTimer.current === null) return
    clearInterval(autoRefreshTimer.current)
    autoRefreshTimer.current = null
  }, [])
  useHydrationEffect(dispatch, hydrationCompleteRef, probeConfiguredServer, markUrlProbed)
  usePersistenceEffect(state, hydrationCompleteRef)
  useLifecycleEffect(
    captureData,
    startAutoRefresh,
    stopAutoRefresh,
    dispatch,
    latestStateRef,
    preservedConsoleLogsRef,
    networkClearCutoffMs
  )
  return { captureData, clearData, latestStateRef }
}
