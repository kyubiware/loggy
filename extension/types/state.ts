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
  /** Whether the panel is currently connected to the server */
  serverConnected: boolean
  /** Captured console log entries */
  consoleLogs: ConsoleMessage[]
  /** Captured network HAR entries */
  networkEntries: HAREntry[]
  /** Maximum estimated token count per tab before oldest entries are purged (0 = disabled) */
  maxTokenLimit: number
}

/**
 * Persisted subset of Loggy settings that should survive panel reloads.
 */
export type PersistedLoggySettings = Pick<
  LoggyState,
  | 'consoleFilter'
  | 'networkFilter'
  | 'consoleVisible'
  | 'networkVisible'
  | 'includeAgentContext'
  | 'includeResponseBodies'
  | 'truncateConsoleLogs'
  | 'redactSensitiveInfo'
  | 'networkExportEnabled'
  | 'autoServerSync'
  | 'serverUrl'
  | 'settingsAccordionOpen'
  | 'maxTokenLimit'
>

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
    consoleVisible: true,
    networkVisible: true,
    includeAgentContext: true,
    includeResponseBodies: false,
    truncateConsoleLogs: true,
    redactSensitiveInfo: true,
    networkExportEnabled: false,
    autoServerSync: false,
    serverSyncError: false,
    serverUrl: 'http://localhost:8743',
    settingsAccordionOpen: true,
    serverConnected: false,
    consoleLogs: [],
    networkEntries: [],
    maxTokenLimit: 50000,
  }
}

/**
 * Extracts only persistable settings from full panel state.
 */
export function extractPersistedSettings(state: LoggyState): PersistedLoggySettings {
  return {
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
  }
}

/**
 * Safely merges unknown stored settings into persisted defaults.
 */
export function mergePersistedSettings(
  stored: unknown,
  defaults: PersistedLoggySettings
): PersistedLoggySettings {
  if (!isRecord(stored)) {
    return { ...defaults }
  }

  return {
    consoleFilter:
      typeof stored.consoleFilter === 'string' ? stored.consoleFilter : defaults.consoleFilter,
    networkFilter:
      typeof stored.networkFilter === 'string' ? stored.networkFilter : defaults.networkFilter,
    consoleVisible:
      typeof stored.consoleVisible === 'boolean' ? stored.consoleVisible : defaults.consoleVisible,
    networkVisible:
      typeof stored.networkVisible === 'boolean' ? stored.networkVisible : defaults.networkVisible,
    includeAgentContext:
      typeof stored.includeAgentContext === 'boolean'
        ? stored.includeAgentContext
        : defaults.includeAgentContext,
    includeResponseBodies:
      typeof stored.includeResponseBodies === 'boolean'
        ? stored.includeResponseBodies
        : defaults.includeResponseBodies,
    truncateConsoleLogs:
      typeof stored.truncateConsoleLogs === 'boolean'
        ? stored.truncateConsoleLogs
        : defaults.truncateConsoleLogs,
    redactSensitiveInfo:
      typeof stored.redactSensitiveInfo === 'boolean'
        ? stored.redactSensitiveInfo
        : defaults.redactSensitiveInfo,
    networkExportEnabled:
      typeof stored.networkExportEnabled === 'boolean'
        ? stored.networkExportEnabled
        : defaults.networkExportEnabled,
    autoServerSync:
      typeof stored.autoServerSync === 'boolean' ? stored.autoServerSync : defaults.autoServerSync,
    serverUrl: typeof stored.serverUrl === 'string' ? stored.serverUrl : defaults.serverUrl,
    settingsAccordionOpen:
      typeof stored.settingsAccordionOpen === 'boolean'
        ? stored.settingsAccordionOpen
        : defaults.settingsAccordionOpen,
    maxTokenLimit:
      typeof stored.maxTokenLimit === 'number' ? stored.maxTokenLimit : defaults.maxTokenLimit,
  }
}
