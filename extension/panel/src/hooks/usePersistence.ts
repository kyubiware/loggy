import { useCallback, useEffect, useRef } from 'react'
import { browser } from '../../../browser-apis/index.js'
import {
  createInitialState,
  extractPersistedSettings,
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  type LoggyState,
  mergePersistedSettings,
  type PersistedLoggySettings,
} from '../../../types/state'
import type { Action } from './useCaptureData'

function getDefaultSettings() {
  const d = createInitialState()
  return {
    consoleFilter: d.consoleFilter,
    networkFilter: d.networkFilter,
    consoleVisible: d.consoleVisible,
    networkVisible: d.networkVisible,
    includeAgentContext: d.includeAgentContext,
    includeResponseBodies: d.includeResponseBodies,
    truncateConsoleLogs: d.truncateConsoleLogs,
    responseBodyMode: d.responseBodyMode,
    redactSensitiveInfo: d.redactSensitiveInfo,
    networkExportEnabled: d.networkExportEnabled,
    autoServerSync: d.autoServerSync,
    serverUrl: d.serverUrl,
    settingsAccordionOpen: d.settingsAccordionOpen,
    filtersAccordionOpen: d.filtersAccordionOpen,
    maxTokenLimit: d.maxTokenLimit,
    deduplicateApiCalls: d.deduplicateApiCalls,
    preserveLogs: d.preserveLogs,
  }
}

export function useHydrationEffect(
  dispatch: React.Dispatch<Action>,
  hydrationCompleteRef: React.MutableRefObject<boolean>,
  probeConfiguredServer: (url: string) => Promise<void>,
  markUrlProbed: (url: string) => void
): void {
  const defaultsRef = useRef(getDefaultSettings())

  const handleStorageResult = useCallback(
    (result: Partial<Record<string, unknown>>): void => {
      const mergedSettings = mergePersistedSettings(
        result[LOGGY_PANEL_SETTINGS_STORAGE_KEY],
        defaultsRef.current
      )

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

export function usePersistenceEffect(
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
