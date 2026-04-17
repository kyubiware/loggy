import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ConsoleMessage } from '../../types/console'
import type { HAREntry } from '../../types/har'
import { getFilteredPanelData } from '../filtered-data'
import type { LoggyState } from '../state'
import { clearAction, copyAction } from './actions'
import { useCaptureData } from './hooks/useCaptureData'
import { useToast } from './hooks/useToast'

export interface LogDataContextValue {
  consoleLogs: ConsoleMessage[]
  networkEntries: HAREntry[]
  routeOptions: string[]
  selectedRoutes: string[]
}

export interface SettingsContextValue {
  consoleFilter: string
  networkFilter: string
  consoleVisible: boolean
  networkVisible: boolean
  includeAgentContext: boolean
  includeResponseBodies: boolean
  truncateConsoleLogs: boolean
  redactSensitiveInfo: boolean
  networkExportEnabled: boolean
  autoServerSync: boolean
  serverSyncError: boolean
  serverUrl: string
  serverConnected: boolean
  filtersVisible: boolean
  toastState: {
    message: string
    type: 'success' | 'error'
    visible: boolean
  }
}

export interface ActionsContextValue {
  setConsoleFilter: (value: string) => void
  setNetworkFilter: (value: string) => void
  toggleConsoleVisibility: () => void
  toggleNetworkVisibility: () => void
  toggleAgentContext: () => void
  toggleResponseBodies: () => void
  toggleConsoleTruncation: () => void
  toggleRedactSensitive: () => void
  toggleNetworkExport: () => void
  toggleAutoServerSync: () => void
  setServerUrl: (url: string) => void
  toggleRoute: (route: string) => void
  selectAllRoutes: () => void
  deselectAllRoutes: () => void
  toggleFiltersVisible: () => void
  refresh: () => Promise<void>
  clearAll: () => Promise<void>
  copy: () => Promise<void>
}

const LogDataContext = createContext<LogDataContextValue | null>(null)
const SettingsContext = createContext<SettingsContextValue | null>(null)
const ActionsContext = createContext<ActionsContextValue | null>(null)

export function useLogData(): LogDataContextValue {
  const context = useContext(LogDataContext)
  if (!context) throw new Error('useLogData must be used within LoggyProvider')
  return context
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used within LoggyProvider')
  return context
}

export function useActions(): ActionsContextValue {
  const context = useContext(ActionsContext)
  if (!context) throw new Error('useActions must be used within LoggyProvider')
  return context
}

export function LoggyProvider({ children }: { children: ReactNode }): ReactNode {
  const { state, dispatch, captureData, clearData } = useCaptureData()
  const { toastState, showToast } = useToast()
  const [filtersVisible, setFiltersVisible] = useState(false)
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>(state.selectedRoutes)

  const contextState = useMemo<LoggyState>(
    () => ({ ...state, selectedRoutes }),
    [selectedRoutes, state]
  )

  const filteredPanelData = useMemo(() => getFilteredPanelData(contextState), [contextState])
  const { routeOptions } = filteredPanelData
  const routeOptionsKey = routeOptions.join(',')
  const stateRef = useRef(state)
  const selectedRoutesRef = useRef(selectedRoutes)
  const routeOptionsRef = useRef(routeOptions)
  const showToastRef = useRef(showToast)
  stateRef.current = state
  selectedRoutesRef.current = selectedRoutes
  routeOptionsRef.current = routeOptions
  showToastRef.current = showToast

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

  const toggleAgentContext = useCallback(() => {
    dispatch({ type: 'TOGGLE_AGENT_CONTEXT' })
  }, [dispatch])

  const toggleResponseBodies = useCallback(() => {
    dispatch({ type: 'TOGGLE_RESPONSE_BODIES' })
  }, [dispatch])

  const toggleConsoleTruncation = useCallback(() => {
    dispatch({ type: 'TOGGLE_CONSOLE_TRUNCATION' })
  }, [dispatch])

  const toggleRedactSensitive = useCallback(() => {
    dispatch({ type: 'TOGGLE_REDACT_SENSITIVE' })
  }, [dispatch])

  const toggleNetworkExport = useCallback(() => {
    dispatch({ type: 'TOGGLE_NETWORK_EXPORT' })
  }, [dispatch])

  const toggleAutoServerSync = useCallback(() => {
    dispatch({ type: 'TOGGLE_AUTO_SERVER_SYNC' })
  }, [dispatch])

  const setServerUrl = useCallback(
    (url: string) => {
      dispatch({ type: 'SET_SERVER_URL', value: url })
    },
    [dispatch]
  )

  const toggleRoute = useCallback((route: string) => {
    setSelectedRoutes((previous) =>
      previous.includes(route)
        ? previous.filter((selectedRoute) => selectedRoute !== route)
        : [...previous, route]
    )
  }, [])

  const selectAllRoutes = useCallback(() => {
    setSelectedRoutes(routeOptions)
  }, [routeOptions])

  const deselectAllRoutes = useCallback(() => {
    setSelectedRoutes([])
  }, [])

  // biome-ignore lint: routeOptionsKey intentionally triggers this effect on content change while using ref to avoid stale closures
  useEffect(() => {
    const currentRouteOptions = routeOptionsRef.current
    setSelectedRoutes((previous) => {
      const staleRemoved = previous.filter((route) => currentRouteOptions.includes(route))
      const newRoutes = currentRouteOptions.filter((route) => !previous.includes(route))
      const next = [...staleRemoved, ...newRoutes]
      return next.length === previous.length && newRoutes.length === 0 ? previous : next
    })
  }, [routeOptionsKey])

  const toggleFiltersVisible = useCallback(() => {
    setFiltersVisible((prev) => !prev)
  }, [])
  const refresh = useCallback(async () => {
    dispatch({ type: 'SET_DATA', consoleLogs: [], networkEntries: [] })
    if (captureData) await captureData()
  }, [captureData, dispatch])

  const clearAll = useCallback(() => {
    return clearAction(clearData, showToastRef.current)
  }, [clearData])

  const copy = useCallback(() => {
    const currentContextState: LoggyState = {
      ...stateRef.current,
      selectedRoutes: selectedRoutesRef.current,
    }
    return copyAction(currentContextState, showToastRef.current)
  }, [])

  const logDataValue = useMemo<LogDataContextValue>(
    () => ({
      consoleLogs: state.consoleLogs,
      networkEntries: state.networkEntries,
      routeOptions,
      selectedRoutes,
    }),
    [state.consoleLogs, state.networkEntries, routeOptions, selectedRoutes]
  )
  const settingsValue = useMemo<SettingsContextValue>(
    () => ({
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
      serverSyncError: state.serverSyncError,
      serverUrl: state.serverUrl,
      serverConnected: state.serverConnected,
      filtersVisible,
      toastState,
    }),
    [state, filtersVisible, toastState]
  )
  const actionsValue = useMemo<ActionsContextValue>(
    () => ({
      setConsoleFilter,
      setNetworkFilter,
      toggleConsoleVisibility,
      toggleNetworkVisibility,
      toggleAgentContext,
      toggleResponseBodies,
      toggleConsoleTruncation,
      toggleRedactSensitive,
      toggleNetworkExport,
      toggleAutoServerSync,
      setServerUrl,
      toggleRoute,
      selectAllRoutes,
      deselectAllRoutes,
      toggleFiltersVisible,
      refresh,
      clearAll,
      copy,
    }),
    [
      setConsoleFilter,
      setNetworkFilter,
      toggleConsoleVisibility,
      toggleNetworkVisibility,
      toggleAgentContext,
      toggleResponseBodies,
      toggleConsoleTruncation,
      toggleRedactSensitive,
      toggleNetworkExport,
      toggleAutoServerSync,
      setServerUrl,
      toggleRoute,
      selectAllRoutes,
      deselectAllRoutes,
      toggleFiltersVisible,
      refresh,
      clearAll,
      copy,
    ]
  )

  return (
    <LogDataContext.Provider value={logDataValue}>
      <SettingsContext.Provider value={settingsValue}>
        <ActionsContext.Provider value={actionsValue}>{children}</ActionsContext.Provider>
      </SettingsContext.Provider>
    </LogDataContext.Provider>
  )
}
