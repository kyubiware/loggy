import type { LucideIcon } from 'lucide-react'
import { Archive, Brain, FileText, RefreshCw, Scissors, Shield, Upload } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { LoggyState } from '../../../types/state'
import { clearAction, copyAction } from '../actions'
import type { ActionsContextValue } from '../LoggyContext.types'
import type { Action } from './useCaptureData'

/**
 * Setting keys that have user-facing toggle controls.
 * Excludes visibility toggles (use TOGGLE_VISIBILITY) and runtime-only flags.
 */
export type ToggleSettingKey =
  | 'includeAgentContext'
  | 'includeResponseBodies'
  | 'truncateConsoleLogs'
  | 'truncateResponseBodies'
  | 'redactSensitiveInfo'
  | 'networkExportEnabled'
  | 'autoServerSync'
  | 'preserveLogs'

/**
 * Maps toggle setting keys to their reducer action types.
 * The reducer stays untouched — this just centralizes the dispatch mapping.
 */
const TOGGLE_ACTION_MAP: Record<ToggleSettingKey, Action['type']> = {
  includeAgentContext: 'TOGGLE_AGENT_CONTEXT',
  includeResponseBodies: 'TOGGLE_RESPONSE_BODIES',
  truncateConsoleLogs: 'TOGGLE_CONSOLE_TRUNCATION',
  truncateResponseBodies: 'TOGGLE_RESPONSE_BODY_TRUNCATION',
  redactSensitiveInfo: 'TOGGLE_REDACT_SENSITIVE',
  networkExportEnabled: 'TOGGLE_NETWORK_EXPORT',
  autoServerSync: 'TOGGLE_AUTO_SERVER_SYNC',
  preserveLogs: 'TOGGLE_PRESERVE_LOGS',
}

/**
 * Configuration for data-driven toggle UI rendering.
 * Each entry maps a setting key to its label and icon.
 */
export const TOGGLE_CONFIGS: Array<{
  key: ToggleSettingKey
  label: string
  icon: LucideIcon
}> = [
  { key: 'includeAgentContext', label: 'Include LLM guidance', icon: Brain },
  { key: 'includeResponseBodies', label: 'Include response bodies', icon: FileText },
  { key: 'truncateConsoleLogs', label: 'Truncate console logs', icon: Scissors },
  { key: 'truncateResponseBodies', label: 'Truncate response bodies', icon: Scissors },
  { key: 'redactSensitiveInfo', label: 'Redact sensitive info', icon: Shield },
  { key: 'networkExportEnabled', label: 'Network export to server', icon: Upload },
  { key: 'autoServerSync', label: 'Auto sync to server', icon: RefreshCw },
  { key: 'preserveLogs', label: 'Preserve logs on reload', icon: Archive },
]

interface UseLoggyActionsParams {
  dispatch: Dispatch<Action>
  captureData: (() => Promise<void>) | undefined
  clearData: () => Promise<void>
  showToastRef: RefObject<(message: string, type: 'success' | 'error') => void>
  stateRef: RefObject<LoggyState>
  selectedRoutesRef: RefObject<string[]>
  setFiltersVisible: Dispatch<SetStateAction<boolean>>
  setSelectedRoutes: Dispatch<SetStateAction<string[]>>
  routeOptions: string[]
}

export function useLoggyActions({
  dispatch,
  captureData,
  clearData,
  showToastRef,
  stateRef,
  selectedRoutesRef,
  setFiltersVisible,
  setSelectedRoutes,
  routeOptions,
}: UseLoggyActionsParams): ActionsContextValue {
  const setConsoleFilter = useCallback(
    (value: string) => {
      dispatch({ type: 'UPDATE_FILTER', field: 'consoleFilter', value })
    },
    [dispatch]
  )

  const setNetworkFilter = useCallback(
    (value: string) => {
      dispatch({ type: 'UPDATE_FILTER', field: 'networkFilter', value })
    },
    [dispatch]
  )

  const toggleConsoleVisibility = useCallback(() => {
    dispatch({ type: 'TOGGLE_VISIBILITY', field: 'consoleVisible' })
  }, [dispatch])

  const toggleNetworkVisibility = useCallback(() => {
    dispatch({ type: 'TOGGLE_VISIBILITY', field: 'networkVisible' })
  }, [dispatch])

  const toggleSetting = useCallback(
    (key: ToggleSettingKey) => {
      dispatch({ type: TOGGLE_ACTION_MAP[key] } as Action)
    },
    [dispatch]
  )

  const setServerUrl = useCallback(
    (url: string) => {
      dispatch({ type: 'SET_SERVER_URL', value: url })
    },
    [dispatch]
  )

  const setMaxTokenLimit = useCallback(
    (value: number) => {
      dispatch({ type: 'SET_MAX_TOKEN_LIMIT', value })
    },
    [dispatch]
  )

  const toggleRoute = useCallback(
    (route: string) => {
      setSelectedRoutes((previous) =>
        previous.includes(route)
          ? previous.filter((selectedRoute) => selectedRoute !== route)
          : [...previous, route]
      )
    },
    [setSelectedRoutes]
  )

  const selectAllRoutes = useCallback(() => {
    setSelectedRoutes(routeOptions)
  }, [routeOptions, setSelectedRoutes])

  const deselectAllRoutes = useCallback(() => {
    setSelectedRoutes([])
  }, [setSelectedRoutes])

  const routeOptionsKey = routeOptions.join(',')
  const routeOptionsRef = useRef(routeOptions)
  routeOptionsRef.current = routeOptions

  // biome-ignore lint: routeOptionsKey intentionally triggers this effect on content change while using ref to avoid stale closures
  useEffect(() => {
    const currentRouteOptions = routeOptionsRef.current
    setSelectedRoutes((previous) => {
      const staleRemoved = previous.filter((route) => currentRouteOptions.includes(route))
      const newRoutes = currentRouteOptions.filter((route) => !previous.includes(route))
      const next = [...staleRemoved, ...newRoutes]
      return next.length === previous.length && newRoutes.length === 0 ? previous : next
    })
  }, [routeOptionsKey, setSelectedRoutes])

  const toggleFiltersVisible = useCallback(() => {
    setFiltersVisible((prev) => !prev)
  }, [setFiltersVisible])

  const refresh = useCallback(async () => {
    dispatch({ type: 'SET_DATA', consoleLogs: [], networkEntries: [] })
    if (captureData) await captureData()
  }, [captureData, dispatch])

  const clearAll = useCallback(() => {
    const showToast = showToastRef.current
    if (!showToast) return Promise.resolve()
    return clearAction(clearData, showToast)
  }, [clearData, showToastRef])

  const copy = useCallback(() => {
    const showToast = showToastRef.current
    if (!showToast) return Promise.resolve()
    const currentState = stateRef.current
    const currentRoutes = selectedRoutesRef.current
    if (!currentState || !currentRoutes) return Promise.resolve()
    const currentContextState: LoggyState = {
      ...currentState,
      selectedRoutes: currentRoutes,
    }
    return copyAction(currentContextState, showToast)
  }, [selectedRoutesRef, showToastRef, stateRef])

  return useMemo(
    () => ({
      setConsoleFilter,
      setNetworkFilter,
      toggleConsoleVisibility,
      toggleNetworkVisibility,
      toggleSetting,
      setServerUrl,
      toggleRoute,
      selectAllRoutes,
      deselectAllRoutes,
      toggleFiltersVisible,
      refresh,
      clearAll,
      copy,
      setMaxTokenLimit,
    }),
    [
      setConsoleFilter,
      setNetworkFilter,
      toggleConsoleVisibility,
      toggleNetworkVisibility,
      toggleSetting,
      setServerUrl,
      toggleRoute,
      selectAllRoutes,
      deselectAllRoutes,
      toggleFiltersVisible,
      refresh,
      clearAll,
      copy,
      setMaxTokenLimit,
    ]
  )
}
