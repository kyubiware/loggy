import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'

export const LOGGY_PANEL_SETTINGS_STORAGE_KEY = 'loggyPanelSettings'

/**
 * State object for the Loggy DevTools panel.
 * Contains filter settings, visibility flags, and captured data.
 */
export interface LoggyState {
  /** Regex pattern for filtering console logs */
  consoleFilter: string
  /** String pattern for filtering network entries (supports include/exclude with - prefix) */
  networkFilter: string
  /** Selected route paths to include in filtered network data */
  selectedRoutes: string[]
  /** Whether newly detected routes are automatically included in the selection */
  autoIncludeRoutes: boolean
  /** Whether console logs are visible in the preview */
  consoleVisible: boolean
  /** Whether network entries are visible in the preview */
  networkVisible: boolean
  /** Whether to include agent context information in export */
  includeAgentContext: boolean
  /** Whether to include response bodies in export */
  includeResponseBodies: boolean
  /** Whether to truncate console log messages in export */
  truncateConsoleLogs: boolean
  /** Response body output mode: 'smart' (elide non-elevated bodies) or 'full' (never truncate) */
  responseBodyMode: 'smart' | 'full'
  /** Whether to deduplicate repeated API calls in export */
  deduplicateApiCalls: boolean
  /** Whether to redact sensitive information in exports */
  redactSensitiveInfo: boolean
  /** Whether network export to server is enabled */
  networkExportEnabled: boolean
  /** Whether to automatically sync exports to the server */
  autoServerSync: boolean
  /** Whether the last server sync attempt failed */
  serverSyncError: boolean
  /** The server URL for the agent connection */
  serverUrl: string
  /** Whether the settings accordion is expanded in the popup */
  settingsAccordionOpen: boolean
  /** Whether the filters accordion is expanded in the popup */
  filtersAccordionOpen: boolean
  /** Whether the panel is currently connected to the server */
  serverConnected: boolean
  /** Captured console log entries */
  consoleLogs: ConsoleMessage[]
  /** Captured network HAR entries */
  networkEntries: HAREntry[]
  /** Maximum estimated token count per tab before oldest entries are purged (0 = disabled) */
  maxTokenLimit: number
  /** Whether to preserve captured logs across page navigations */
  preserveLogs: boolean
}

/**
 * Single source of truth for which LoggyState keys are persisted.
 * Add or remove a key here to update all persistence logic automatically.
 */
export const PERSISTED_SETTINGS_KEYS = [
  'consoleFilter',
  'networkFilter',
  'autoIncludeRoutes',
  'consoleVisible',
  'networkVisible',
  'includeAgentContext',
  'includeResponseBodies',
  'truncateConsoleLogs',
  'responseBodyMode',
  'deduplicateApiCalls',
  'redactSensitiveInfo',
  'networkExportEnabled',
  'autoServerSync',
  'serverUrl',
  'settingsAccordionOpen',
  'filtersAccordionOpen',
  'maxTokenLimit',
  'preserveLogs',
] as const satisfies ReadonlyArray<keyof LoggyState>

/**
 * Persisted subset of Loggy settings that should survive panel reloads.
 */
export type PersistedLoggySettings = Pick<LoggyState, (typeof PERSISTED_SETTINGS_KEYS)[number]>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Creates the initial state for a new Loggy panel session.
 * @returns A new LoggyState object with default values.
 */
export function createInitialState(): LoggyState {
  return {
    consoleFilter: '',
    networkFilter: '',
    selectedRoutes: [],
    autoIncludeRoutes: true,
    consoleVisible: true,
    networkVisible: true,
    includeAgentContext: true,
    includeResponseBodies: false,
    truncateConsoleLogs: true,
    responseBodyMode: 'smart',
    deduplicateApiCalls: true,
    redactSensitiveInfo: true,
    networkExportEnabled: false,
    autoServerSync: false,
    serverSyncError: false,
    serverUrl: 'http://localhost:8743',
    settingsAccordionOpen: true,
    filtersAccordionOpen: true,
    serverConnected: false,
    consoleLogs: [],
    networkEntries: [],
    maxTokenLimit: 10000,
    preserveLogs: false,
  }
}

/**
 * Returns a fresh PersistedLoggySettings with all default values.
 */
export function createDefaultSettings(): PersistedLoggySettings {
  return extractPersistedSettings(createInitialState())
}

/**
 * Extracts only persistable settings from full panel state.
 */
export function extractPersistedSettings(state: LoggyState): PersistedLoggySettings {
  return Object.fromEntries(
    PERSISTED_SETTINGS_KEYS.map((key) => [key, state[key]])
  ) as PersistedLoggySettings
}

/**
 * Safely merges unknown stored settings into persisted defaults.
 * Validates each key by comparing typeof against the default value.
 */
export function mergePersistedSettings(
  stored: unknown,
  defaults: PersistedLoggySettings
): PersistedLoggySettings {
  if (!isRecord(stored)) {
    return { ...defaults }
  }

  return Object.fromEntries(
    PERSISTED_SETTINGS_KEYS.map((key) => {
      const storedVal = stored[key]
      const defaultVal = defaults[key]
      const isValid = typeof storedVal === typeof defaultVal
      return [key, isValid ? storedVal : defaultVal]
    })
  ) as PersistedLoggySettings
}
