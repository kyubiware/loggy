import { useReducer, useRef } from 'react'
import type { ConsoleMessage } from '../../../types/console'
import type { HAREntry } from '../../../types/har'
import {
  createInitialState,
  type LoggyState,
  mergePersistedSettings,
  type PersistedLoggySettings,
} from '../../../types/state'
import { debugLog } from '../../../utils/debug-logger'
import { useAutoSync } from './useAutoSync'
import { useDataCapabilities } from './useDataCapabilities'
import { useServerProbe } from './useServerProbe'

/**
 * Build a content fingerprint from the export-relevant state fields.
 * Excludes timestamp so the fingerprint is stable across identical data.
 */
export function buildExportFingerprint(s: LoggyState): string {
  try {
    return JSON.stringify({
      c: s.consoleLogs,
      n: s.networkEntries,
      ac: s.includeAgentContext,
      rb: s.includeResponseBodies,
      tc: s.truncateConsoleLogs,
      rbm: s.responseBodyMode,
      ri: s.redactSensitiveInfo,
      ne: s.networkExportEnabled,
      cf: s.consoleFilter,
      nf: s.networkFilter,
      sr: s.selectedRoutes,
    })
  } catch {
    return `lengths:${s.consoleLogs.length}:${s.networkEntries.length}:${s.selectedRoutes.length}`
  }
}

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
  | { type: 'TOGGLE_PRESERVE_LOGS' }
  | { type: 'TOGGLE_DEDUPLICATE_API_CALLS' }
  | { type: 'TOGGLE_AUTO_INCLUDE_ROUTES' }

const TOGGLE_FLAG_KEY: Record<string, keyof LoggyState> = {
  TOGGLE_AGENT_CONTEXT: 'includeAgentContext',
  TOGGLE_RESPONSE_BODIES: 'includeResponseBodies',
  TOGGLE_CONSOLE_TRUNCATION: 'truncateConsoleLogs',

  TOGGLE_REDACT_SENSITIVE: 'redactSensitiveInfo',
  TOGGLE_NETWORK_EXPORT: 'networkExportEnabled',
  TOGGLE_AUTO_SERVER_SYNC: 'autoServerSync',
  TOGGLE_PRESERVE_LOGS: 'preserveLogs',
  TOGGLE_DEDUPLICATE_API_CALLS: 'deduplicateApiCalls',
  TOGGLE_AUTO_INCLUDE_ROUTES: 'autoIncludeRoutes',
}

const SET_VALUE_KEY: Record<string, keyof LoggyState> = {
  SET_SERVER_SYNC_ERROR: 'serverSyncError',
  SET_SERVER_URL: 'serverUrl',
  SET_SERVER_CONNECTED: 'serverConnected',
  SET_MAX_TOKEN_LIMIT: 'maxTokenLimit',
}

function hydrateSettings(state: LoggyState, settings: PersistedLoggySettings): LoggyState {
  const hydratedSettings = mergePersistedSettings(settings, {
    consoleFilter: state.consoleFilter,
    networkFilter: state.networkFilter,
    consoleVisible: state.consoleVisible,
    networkVisible: state.networkVisible,
    includeAgentContext: state.includeAgentContext,
    includeResponseBodies: state.includeResponseBodies,
    truncateConsoleLogs: state.truncateConsoleLogs,
    responseBodyMode: state.responseBodyMode,
    redactSensitiveInfo: state.redactSensitiveInfo,
    networkExportEnabled: state.networkExportEnabled,
    autoServerSync: state.autoServerSync,
    serverUrl: state.serverUrl,
    settingsAccordionOpen: state.settingsAccordionOpen,
    filtersAccordionOpen: state.filtersAccordionOpen,
    maxTokenLimit: state.maxTokenLimit,
    deduplicateApiCalls: state.deduplicateApiCalls,
    preserveLogs: state.preserveLogs,
    autoIncludeRoutes: state.autoIncludeRoutes,
  })
  return { ...state, ...hydratedSettings }
}

export function reducer(state: LoggyState, action: Action): LoggyState {
  const toggleKey = TOGGLE_FLAG_KEY[action.type]
  if (toggleKey) {
    const newValue = !(state[toggleKey] as boolean)
    debugLog(
      'lifecycle',
      'panel',
      `reducer: TOGGLE ${toggleKey}: ${state[toggleKey]} → ${newValue}`
    )
    return { ...state, [toggleKey]: newValue }
  }

  const setKey = SET_VALUE_KEY[action.type]
  if (setKey) {
    return { ...state, [setKey]: (action as Record<string, unknown>).value } as LoggyState
  }

  switch (action.type) {
    case 'SET_DATA':
      debugLog('capture', 'panel', `reducer: SET_DATA`, {
        consoleLogs: action.consoleLogs.length,
        networkEntries: action.networkEntries.length,
        preserveLogs: state.preserveLogs,
      })
      return {
        ...state,
        consoleLogs: action.consoleLogs,
        networkEntries: action.networkEntries,
      }
    case 'RESET_DATA':
      debugLog(
        'lifecycle',
        'panel',
        `reducer: RESET_DATA (clearing ${state.consoleLogs.length} console, ${state.networkEntries.length} network)`,
        {
          preserveLogs: state.preserveLogs,
        }
      )
      return {
        ...state,
        consoleLogs: [],
        networkEntries: [],
      }
    case 'HYDRATE_SETTINGS':
      debugLog('storage', 'panel', `reducer: HYDRATE_SETTINGS`, {
        preserveLogs: action.settings.preserveLogs,
        keys: Object.keys(action.settings),
      })
      return hydrateSettings(state, action.settings)
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
  const hydrationCompleteRef = useRef(false)

  const { probeConfiguredServer, markUrlProbed } = useServerProbe(
    dispatch,
    state.serverUrl,
    hydrationCompleteRef
  )
  const { captureData, clearData, latestStateRef } = useDataCapabilities(
    dispatch,
    state,
    probeConfiguredServer,
    hydrationCompleteRef,
    markUrlProbed
  )
  useAutoSync(state, dispatch, latestStateRef)

  return { state, dispatch, captureData, clearData }
}
