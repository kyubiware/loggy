import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { LoggyState } from '../../../types/state'
import { clearAction, copyAction } from '../actions'
import type { ActionsContextValue } from '../LoggyContext.types'
import type { Action } from './useCaptureData'

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

  const setMaxTokenLimit = useCallback(
    (value: number) => {
      dispatch({ type: 'SET_MAX_TOKEN_LIMIT', value })
    },
    [dispatch]
  )

  const togglePreserveLogs = useCallback(() => {
    dispatch({ type: 'TOGGLE_PRESERVE_LOGS' })
  }, [dispatch])

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
    console.log(
      '[Loggy:panel] COPY BUTTON CLICKED! stateRef:',
      stateRef.current ? 'exists' : 'null',
      'selectedRoutesRef:',
      selectedRoutesRef.current ? 'exists' : 'null'
    )
    const showToast = showToastRef.current
    if (!showToast) return Promise.resolve()
    const currentState = stateRef.current
    const currentRoutes = selectedRoutesRef.current
    if (!currentState || !currentRoutes) return Promise.resolve()
    const currentContextState: LoggyState = {
      ...currentState,
      selectedRoutes: currentRoutes,
    }
    console.log(
      '[Loggy:panel] COPY: about to call copyAction, serverConnected:',
      currentContextState.serverConnected
    )
    return copyAction(currentContextState, showToast)
  }, [selectedRoutesRef, showToastRef, stateRef])

  return useMemo(
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
      setMaxTokenLimit,
      togglePreserveLogs,
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
      setMaxTokenLimit,
      togglePreserveLogs,
    ]
  )
}
