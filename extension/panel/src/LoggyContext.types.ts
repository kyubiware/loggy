/**
 * Context value type definitions for Loggy panel state.
 */
import type { ConsoleMessage } from '../../types/console'
import type { HAREntry } from '../../types/har'

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
  maxTokenLimit: number
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
  setMaxTokenLimit: (value: number) => void
}
