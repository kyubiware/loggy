import type { LucideIcon } from 'lucide-react'
import { Archive, Brain, Copy, FileText, RefreshCw, Scissors, Shield, Upload } from 'lucide-react'
import type { Dispatch, RefObject, SetStateAction } from 'react'
import { useCallback, useMemo } from 'react'
import type { LoggyState } from '../../../types/state'
import type { ActionsContextValue } from '../LoggyContext.types'
import type { Action } from './useCaptureData'
import { useDataActions } from './useDataActions'
import { useFilterActions } from './useFilterActions'
import { useRouteActions } from './useRouteActions'

/**
 * Setting keys that have user-facing toggle controls.
 * Excludes visibility toggles (use TOGGLE_VISIBILITY) and runtime-only flags.
 */
export type ToggleSettingKey =
  | 'includeAgentContext'
  | 'includeResponseBodies'
  | 'truncateConsoleLogs'
  | 'redactSensitiveInfo'
  | 'networkExportEnabled'
  | 'autoServerSync'
  | 'preserveLogs'
  | 'deduplicateApiCalls'

/**
 * Maps toggle setting keys to their reducer action types.
 * The reducer stays untouched — this just centralizes the dispatch mapping.
 */
const TOGGLE_ACTION_MAP: Record<ToggleSettingKey, Action['type']> = {
  includeAgentContext: 'TOGGLE_AGENT_CONTEXT',
  includeResponseBodies: 'TOGGLE_RESPONSE_BODIES',
  truncateConsoleLogs: 'TOGGLE_CONSOLE_TRUNCATION',

  redactSensitiveInfo: 'TOGGLE_REDACT_SENSITIVE',
  networkExportEnabled: 'TOGGLE_NETWORK_EXPORT',
  autoServerSync: 'TOGGLE_AUTO_SERVER_SYNC',
  preserveLogs: 'TOGGLE_PRESERVE_LOGS',
  deduplicateApiCalls: 'TOGGLE_DEDUPLICATE_API_CALLS',
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

  { key: 'redactSensitiveInfo', label: 'Redact sensitive info', icon: Shield },
  { key: 'networkExportEnabled', label: 'Network export to server', icon: Upload },
  { key: 'autoServerSync', label: 'Auto sync to server', icon: RefreshCw },
  { key: 'deduplicateApiCalls', label: 'Deduplicate API calls', icon: Copy },
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
  const filterActions = useFilterActions({ dispatch, setFiltersVisible })
  const routeActions = useRouteActions({ setSelectedRoutes, routeOptions })
  const dataActions = useDataActions({
    captureData,
    clearData,
    showToastRef,
    stateRef,
    selectedRoutesRef,
    dispatch,
  })

  const toggleSetting = useCallback(
    (key: ToggleSettingKey) => dispatch({ type: TOGGLE_ACTION_MAP[key] } as Action),
    [dispatch]
  )

  const setServerUrl = useCallback(
    (url: string) => dispatch({ type: 'SET_SERVER_URL', value: url }),
    [dispatch]
  )

  const setMaxTokenLimit = useCallback(
    (value: number) => dispatch({ type: 'SET_MAX_TOKEN_LIMIT', value }),
    [dispatch]
  )

  return useMemo(
    () => ({
      ...filterActions,
      ...routeActions,
      ...dataActions,
      toggleSetting,
      setServerUrl,
      setMaxTokenLimit,
    }),
    [filterActions, routeActions, dataActions, toggleSetting, setServerUrl, setMaxTokenLimit]
  )
}
