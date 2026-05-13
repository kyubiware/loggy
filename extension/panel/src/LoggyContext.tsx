import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from 'react'
import type { LoggyState } from '../../types/state'
import { getFilteredPanelData } from '../../utils/filtered-data'
import { useCaptureData } from './hooks/useCaptureData'
import { useLoggyActions } from './hooks/useLoggyActions'
import { useToast } from './hooks/useToast'
import type {
  ActionsContextValue,
  LogDataContextValue,
  SettingsContextValue,
} from './LoggyContext.types'

export type {
  ActionsContextValue,
  LogDataContextValue,
  SettingsContextValue,
} from './LoggyContext.types'

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
  const stateRef = useRef(state)
  const selectedRoutesRef = useRef(selectedRoutes)
  const showToastRef = useRef(showToast)
  stateRef.current = state
  selectedRoutesRef.current = selectedRoutes
  showToastRef.current = showToast
  const actionsValue = useLoggyActions({
    dispatch,
    captureData,
    clearData,
    showToastRef,
    stateRef,
    selectedRoutesRef,
    setFiltersVisible,
    setSelectedRoutes,
    routeOptions,
  })

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
      truncateResponseBodies: state.truncateResponseBodies,
      redactSensitiveInfo: state.redactSensitiveInfo,
      networkExportEnabled: state.networkExportEnabled,
      autoServerSync: state.autoServerSync,
      serverSyncError: state.serverSyncError,
      serverUrl: state.serverUrl,
      serverConnected: state.serverConnected,
      filtersVisible,
      toastState,
      maxTokenLimit: state.maxTokenLimit,
      deduplicateApiCalls: state.deduplicateApiCalls,
      preserveLogs: state.preserveLogs,
    }),
    [state, filtersVisible, toastState]
  )

  return (
    <LogDataContext.Provider value={logDataValue}>
      <SettingsContext.Provider value={settingsValue}>
        <ActionsContext.Provider value={actionsValue}>{children}</ActionsContext.Provider>
      </SettingsContext.Provider>
    </LogDataContext.Provider>
  )
}
