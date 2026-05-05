// biome-ignore lint/nursery/noExcessiveLinesPerFile: limit
import { useCallback, useEffect, useReducer, useRef } from 'react'
import { browser } from '../../../browser-apis/index.js'
import { buildExportMarkdown } from '../../../shared/export'
import { pushToServer } from '../../../shared/server-export'
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
import { probeServer } from '../../server-probe'

const AUTO_REFRESH_INTERVAL_MS = 2000
const DEFAULT_SERVER_URL = 'http://localhost:8743'
const SERVER_POLL_INTERVAL_MS = 5000

export type Action =
  | { type: 'SET_DATA'; consoleLogs: ConsoleMessage[]; networkEntries: HAREntry[] }
  | { type: 'RESET_DATA' }
  | { type: 'HYDRATE_SETTINGS'; settings: PersistedLoggySettings }
  | { type: 'UPDATE_FILTER'; field: 'consoleFilter' | 'networkFilter'; value: string }
  | { type: 'TOGGLE_VISIBILITY'; field: 'consoleVisible' | 'networkVisible' }
  | { type: 'TOGGLE_AGENT_CONTEXT' }
  | { type: 'TOGGLE_RESPONSE_BODIES' }
  | { type: 'TOGGLE_CONSOLE_TRUNCATION' }
  | { type: 'TOGGLE_REDACT_SENSITIVE' }
  | { type: 'TOGGLE_NETWORK_EXPORT' }
  | { type: 'TOGGLE_AUTO_SERVER_SYNC' }
  | { type: 'SET_SERVER_SYNC_ERROR'; value: boolean }
  | { type: 'SET_SERVER_URL'; value: string }
  | { type: 'SET_SERVER_CONNECTED'; value: boolean }
  | { type: 'SET_MAX_TOKEN_LIMIT'; value: number }

export function reducer(state: LoggyState, action: Action): LoggyState {
  switch (action.type) {
    case 'SET_DATA':
      return {
        ...state,
        consoleLogs: action.consoleLogs,
        networkEntries: action.networkEntries,
      }
    case 'RESET_DATA':
      return {
        ...state,
        consoleLogs: [],
        networkEntries: [],
      }
    case 'HYDRATE_SETTINGS': {
      const hydratedSettings = mergePersistedSettings(action.settings, {
        consoleFilter: state.consoleFilter,
        networkFilter: state.networkFilter,
        consoleVisible: state.consoleVisible,
        networkVisible: state.networkVisible,
        includeAgentContext: state.includeAgentContext,
        includeResponseBodies: state.includeResponseBodies,
        truncateConsoleLogs: state.truncateConsoleLogs,
        redactSensitiveInfo: state.redactSensitiveInfo,
        networkExportEnabled: state.networkExportEnabled,
        autoServerSync: state.autoServerSync,
        serverUrl: state.serverUrl,
        settingsAccordionOpen: state.settingsAccordionOpen,
        maxTokenLimit: state.maxTokenLimit,
      })

      return {
        ...state,
        ...hydratedSettings,
      }
    }
    case 'UPDATE_FILTER':
      return {
        ...state,
        [action.field]: action.value,
      }
    case 'TOGGLE_VISIBILITY':
      return {
        ...state,
        [action.field]: !state[action.field],
      }
    case 'TOGGLE_AGENT_CONTEXT':
      return {
        ...state,
        includeAgentContext: !state.includeAgentContext,
      }
    case 'TOGGLE_RESPONSE_BODIES':
      return {
        ...state,
        includeResponseBodies: !state.includeResponseBodies,
      }
    case 'TOGGLE_CONSOLE_TRUNCATION':
      return {
        ...state,
        truncateConsoleLogs: !state.truncateConsoleLogs,
      }
    case 'TOGGLE_REDACT_SENSITIVE':
      return {
        ...state,
        redactSensitiveInfo: !state.redactSensitiveInfo,
      }
    case 'TOGGLE_NETWORK_EXPORT':
      return {
        ...state,
        networkExportEnabled: !state.networkExportEnabled,
      }
    case 'TOGGLE_AUTO_SERVER_SYNC':
      return {
        ...state,
        autoServerSync: !state.autoServerSync,
      }
    case 'SET_SERVER_SYNC_ERROR':
      return {
        ...state,
        serverSyncError: action.value,
      }
    case 'SET_SERVER_URL':
      return {
        ...state,
        serverUrl: action.value,
      }
    case 'SET_SERVER_CONNECTED':
      return {
        ...state,
        serverConnected: action.value,
      }
    case 'SET_MAX_TOKEN_LIMIT':
      return {
        ...state,
        maxTokenLimit: action.value,
      }
    default:
      return state
  }
}

export function useCaptureData(): {
  state: LoggyState
  dispatch: React.Dispatch<Action>
  captureData: () => Promise<void>
  clearData: () => Promise<void>
} {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState)
  const isCapturing = useRef(false)
  const hydrationCompleteRef = useRef(false)
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const serverPollTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const networkClearCutoffMs = useRef<number | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastProbedUrlRef = useRef<string | null>(null)
  const latestStateRef = useRef(state)

  const probeConfiguredServer = useCallback(async (configuredServerUrl: string): Promise<void> => {
    const configuredConnected = await probeServer(configuredServerUrl)
    if (configuredConnected) {
      dispatch({ type: 'SET_SERVER_CONNECTED', value: true })
      return
    }

    if (configuredServerUrl !== DEFAULT_SERVER_URL) {
      const fallbackConnected = await probeServer(DEFAULT_SERVER_URL)
      dispatch({ type: 'SET_SERVER_CONNECTED', value: fallbackConnected })
      return
    }

    dispatch({ type: 'SET_SERVER_CONNECTED', value: false })
  }, [])

  const filterNetworkEntriesAfterClear = useCallback((entries: HAREntry[]): HAREntry[] => {
    const cutoffMs = networkClearCutoffMs.current
    if (cutoffMs === null) {
      return entries
    }

    return entries.filter((entry) => {
      const entryTimeMs = Date.parse(entry.startedDateTime)
      if (Number.isNaN(entryTimeMs)) {
        return false
      }

      return entryTimeMs > cutoffMs
    })
  }, [])

  const captureData = useCallback(async (): Promise<void> => {
    if (isCapturing.current) return
    isCapturing.current = true

    try {
      const rawEntries = await captureNetworkEntries()
      const networkEntries = enrichWithResponseBodies(filterNetworkEntriesAfterClear(rawEntries))
      const consoleLogs = await captureConsoleLogs()
      dispatch({ type: 'SET_DATA', consoleLogs, networkEntries })
    } catch (error) {
      console.error('Error capturing data:', error)
    } finally {
      isCapturing.current = false
    }
  }, [filterNetworkEntriesAfterClear])

  const clearData = useCallback(async (): Promise<void> => {
    dispatch({ type: 'RESET_DATA' })

    networkClearCutoffMs.current = Date.now()
    await clearCapturedConsoleLogs()
  }, [])

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

  const completeHydrationAfterFailure = useCallback((error: unknown): void => {
    console.error('Failed to hydrate persisted Loggy panel settings:', error)
    hydrationCompleteRef.current = true
  }, [])

  useEffect(() => {
    let cancelled = false
    const defaults = createInitialState()

    try {
      browser.storage.local.get([LOGGY_PANEL_SETTINGS_STORAGE_KEY], (result) => {
        const mergedSettings = mergePersistedSettings(result[LOGGY_PANEL_SETTINGS_STORAGE_KEY], {
          consoleFilter: defaults.consoleFilter,
          networkFilter: defaults.networkFilter,
          consoleVisible: defaults.consoleVisible,
          networkVisible: defaults.networkVisible,
          includeAgentContext: defaults.includeAgentContext,
          includeResponseBodies: defaults.includeResponseBodies,
          truncateConsoleLogs: defaults.truncateConsoleLogs,
          redactSensitiveInfo: defaults.redactSensitiveInfo,
          networkExportEnabled: defaults.networkExportEnabled,
          autoServerSync: defaults.autoServerSync,
          serverUrl: defaults.serverUrl,
          settingsAccordionOpen: defaults.settingsAccordionOpen,
          maxTokenLimit: defaults.maxTokenLimit,
        })

        if (result[LOGGY_PANEL_SETTINGS_STORAGE_KEY] !== undefined) {
          dispatch({
            type: 'HYDRATE_SETTINGS',
            settings: result[LOGGY_PANEL_SETTINGS_STORAGE_KEY] as PersistedLoggySettings,
          })
        }

        hydrationCompleteRef.current = true

        if (!cancelled) {
          lastProbedUrlRef.current = mergedSettings.serverUrl
          void probeConfiguredServer(mergedSettings.serverUrl)
        }
      })
    } catch (error) {
      completeHydrationAfterFailure(error)

      if (!cancelled) {
        lastProbedUrlRef.current = defaults.serverUrl
        void probeConfiguredServer(defaults.serverUrl)
      }
    }

    return () => {
      cancelled = true
    }
  }, [completeHydrationAfterFailure, probeConfiguredServer])

  // Probe server when serverUrl changes (after hydration)
  useEffect(() => {
    if (!hydrationCompleteRef.current) return
    if (lastProbedUrlRef.current === state.serverUrl) return

    lastProbedUrlRef.current = state.serverUrl
    void probeConfiguredServer(state.serverUrl)
  }, [state.serverUrl, probeConfiguredServer])

  // Start/stop server polling based on hydration state and serverUrl
  useEffect(() => {
    if (!hydrationCompleteRef.current) return

    // Start polling
    if (serverPollTimer.current === null) {
      serverPollTimer.current = setInterval(() => {
        void probeConfiguredServer(state.serverUrl)
      }, SERVER_POLL_INTERVAL_MS)
    }

    return () => {
      if (serverPollTimer.current !== null) {
        clearInterval(serverPollTimer.current)
        serverPollTimer.current = null
      }
    }
  }, [probeConfiguredServer, state.serverUrl])

  // Only persist the subset of settings that should survive panel reloads
  const persistedSettings = extractPersistedSettings(state)

  useEffect(() => {
    latestStateRef.current = state
  }, [state])

  useEffect(() => {
    if (!hydrationCompleteRef.current) {
      return
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      browser.storage.local.set({
        [LOGGY_PANEL_SETTINGS_STORAGE_KEY]: persistedSettings,
      })
    }, 300)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [persistedSettings])

  useEffect(() => {
    const scheduledConsoleLogs = state.consoleLogs
    const scheduledNetworkEntries = state.networkEntries

    if (autoSyncTimeoutRef.current) {
      clearTimeout(autoSyncTimeoutRef.current)
      autoSyncTimeoutRef.current = null
    }

    if (!state.autoServerSync || !state.serverConnected) {
      return
    }

    autoSyncTimeoutRef.current = setTimeout(() => {
      void (async () => {
        const latestState = latestStateRef.current

        if (
          latestState.consoleLogs !== scheduledConsoleLogs ||
          latestState.networkEntries !== scheduledNetworkEntries
        ) {
          return
        }

        const markdown = await buildExportMarkdown(latestState)
        const success = await pushToServer(latestState.serverUrl, markdown)

        dispatch({ type: 'SET_SERVER_SYNC_ERROR', value: !success })
      })()
    }, 2500)

    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current)
        autoSyncTimeoutRef.current = null
      }
    }
  }, [state.autoServerSync, state.serverConnected, state.consoleLogs, state.networkEntries])

  // Trigger server sync when export options or filters change (if auto-sync is enabled and content exists)
  // biome-ignore lint: dependencies are intentionally specified to trigger re-export when options/filters change
  useEffect(() => {
    if (!state.autoServerSync || !state.serverConnected) {
      return
    }

    // Only sync if there's actual data to export
    if (state.consoleLogs.length === 0 && state.networkEntries.length === 0) {
      return
    }

    if (autoSyncTimeoutRef.current) {
      clearTimeout(autoSyncTimeoutRef.current)
    }

    autoSyncTimeoutRef.current = setTimeout(() => {
      void (async () => {
        const latestState = latestStateRef.current
        const markdown = await buildExportMarkdown(latestState)
        const success = await pushToServer(latestState.serverUrl, markdown)
        dispatch({ type: 'SET_SERVER_SYNC_ERROR', value: !success })
      })()
    }, 500)

    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current)
        autoSyncTimeoutRef.current = null
      }
    }
  }, [
    state.autoServerSync,
    state.serverConnected,
    state.consoleLogs.length,
    state.networkEntries.length,
    state.includeAgentContext,
    state.includeResponseBodies,
    state.truncateConsoleLogs,
    state.redactSensitiveInfo,
    state.networkExportEnabled,
    state.consoleFilter,
    state.networkFilter,
    dispatch,
  ])

  useEffect(() => {
    startResponseBodyCapture()

    const inspectedTabId = chrome.devtools.inspectedWindow.tabId
    if (typeof inspectedTabId === 'number') {
      notifyPanelOpened(inspectedTabId)
    }

    // Startup capture (like LoggyPanel constructor)
    void captureData()

    // Start auto-refresh if visible (like constructor)
    if (document.visibilityState === 'visible') {
      startAutoRefresh()
    }

    // Visibility change listener
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        startAutoRefresh()
        void captureData()
        return
      }
      stopAutoRefresh()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Navigation reset listener
    const handleNavigated = (): void => {
      dispatch({ type: 'RESET_DATA' })
      networkClearCutoffMs.current = null
      clearResponseBodies()
    }
    browser.devtools.network.onNavigated.addListener(handleNavigated)

    // Cleanup on unmount
    return () => {
      if (typeof inspectedTabId === 'number') {
        notifyPanelClosed(inspectedTabId)
      }

      stopAutoRefresh()
      stopResponseBodyCapture()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      browser.devtools.network.onNavigated.removeListener(handleNavigated)
    }
  }, [captureData, startAutoRefresh, stopAutoRefresh])

  return { state, dispatch, captureData, clearData }
}
