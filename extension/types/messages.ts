import type { ConsoleLevel, ConsoleMessage } from './console.ts'
import type { HAREntry } from './har.ts'

/**
 * Capture modes supported by Loggy.
 */
export type CaptureMode = 'content-script' | 'debugger' | 'devtools' | 'inactive'

/**
 * Namespace used for relay messages.
 */
export const LOGGY_MESSAGE_NAMESPACE = '__LOGGY_RELAY__' as const

/**
 * Console entry captured by the background capture pipeline.
 */
export interface CapturedConsoleEntry {
  /** ISO 8601 timestamp of the log. */
  timestamp: string
  /** Log level. */
  level: ConsoleLevel
  /** Log message text. */
  message: string
}

/**
 * Simplified network entry captured by the background capture pipeline.
 */
export interface CapturedNetworkEntry {
  /** ISO 8601 timestamp of the request start. */
  timestamp: string
  /** Request URL. */
  url: string
  /** HTTP method. */
  method: string
  /** HTTP response status code. */
  status: number
  /** Request headers keyed by header name. */
  requestHeaders?: Record<string, string>
  /** Request body text. */
  requestBody?: string
  /** Response headers keyed by header name. */
  responseHeaders?: Record<string, string>
  /** Response body text. */
  responseBody?: string
  /** Response content type. */
  contentType?: string
  /** Request duration in milliseconds. */
  duration?: number
}

/**
 * Console relay message payload.
 */
export interface ConsoleCaptureMessage {
  /** Message source. */
  source: 'console'
  /** Captured console payload. */
  payload: CapturedConsoleEntry
}

/**
 * Network relay message payload.
 */
export interface NetworkCaptureMessage {
  /** Message source. */
  source: 'network'
  /** Captured network payload. */
  payload: CapturedNetworkEntry
}

/**
 * Request to read the current capture status.
 */
export interface GetStatusMessage {
  /** Message type. */
  type: 'get-status'
}

/**
 * Request exported data for a tab.
 */
export interface GetTabExportDataMessage {
  /** Message type. */
  type: 'get-tab-export-data'
  /** Target tab identifier. */
  tabId: number
}

/**
 * Request capture status for a specific tab.
 * Used by content scripts that need their own tab's state
 * (unlike get-status which returns the globally active tab).
 */
export interface GetTabStatusMessage {
  /** Message type. */
  type: 'get-tab-status'
}

/**
 * Broadcast sent to content scripts when consent or capture state changes.
 */
export interface ConsentChangedMessage {
  /** Message type. */
  type: 'consent-changed'
  /** Whether consent has been granted. */
  hasConsent?: boolean
  /** Current capture mode. */
  captureMode?: CaptureMode | 'none'
}

/**
 * Request to enable or disable debugger capture for a tab.
 */
export interface ToggleDebuggerMessage {
  /** Message type. */
  type: 'toggle-debugger'
  /** Target tab identifier. */
  tabId: number
}

/**
 * Request to cache a markdown preview snapshot.
 */
export interface CachePreviewMessage {
  /** Message type. */
  type: 'cache-preview'
  /** Markdown content to cache. */
  markdown: string
}

/**
 * Request to retrieve a cached markdown preview.
 */
export interface GetCachedPreviewMessage {
  /** Message type. */
  type: 'get-cached-preview'
  /** Cache entry identifier. */
  id: string
}

/**
 * Current capture status response.
 */
export interface StatusResponse {
  /** Current capture mode. */
  mode: CaptureMode
  /** Target tab identifier. */
  tabId: number
  /** Number of captured log entries. */
  logCount: number
  /** Whether the capture relay is connected. */
  connected: boolean
}

/**
 * Stored always-log host entry.
 */
export interface AlwaysLogHost {
  /** Host name. */
  host: string
  /** Creation timestamp. */
  createdAt: number
}

/**
 * Consent state returned by the background service.
 */
export interface ConsentState {
  /** Whether the host has consent. */
  hasConsent: boolean
  /** Current capture mode or none. */
  captureMode: CaptureMode | 'none'
  /** Optional reason for the consent decision. */
  reason?: string
}

/**
 * Export data response for a tab.
 */
export interface TabExportDataResponse {
  /** Total token count. */
  tokenCount: number
  /** Exported markdown content. */
  markdown: string
  /** Whether the tab has exportable data. */
  hasData: boolean
  /** Number of logs included in the export. */
  logCount: number
}

/**
 * Response containing the cached preview identifier.
 */
export interface CachePreviewResponse {
  /** Cache entry identifier. */
  id: string
}

/**
 * Response containing the cached markdown content.
 */
export interface CachedPreviewResponse {
  /** Cached markdown content, or null if not found or expired. */
  markdown: string | null
}

/**
 * Notification that the panel has opened.
 */
export interface PanelOpenedMessage {
  /** Message type. */
  type: 'panel-opened'
  /** Target tab identifier. */
  tabId: number
}

/**
 * Notification that the panel has closed.
 */
export interface PanelClosedMessage {
  /** Message type. */
  type: 'panel-closed'
  /** Target tab identifier. */
  tabId: number
}

/**
 * Notification that the content relay is ready.
 */
export interface ContentRelayReadyMessage {
  /** Message type. */
  type: 'content-relay-ready'
  /** Current page URL. */
  url: string
  /** Optional tab identifier. */
  tabId?: number
}

/**
 * Request consent for the current page URL.
 */
export interface RequestConsentMessage {
  /** Message type. */
  type: 'request-consent'
  /** Current page URL. */
  url?: string
  /** Target tab identifier (required when sent from DevTools panel). */
  tabId?: number
}

/**
 * Consent response returned by the background service.
 */
export interface ConsentResponseMessage {
  /** Message type. */
  type: 'consent-response'
  /** Whether the host has consent. */
  hasConsent: boolean
  /** Current capture mode or none. */
  captureMode: CaptureMode | 'none'
  /** Optional reason for the consent decision. */
  reason?: string
}

/**
 * Request to start logging for a tab.
 */
export interface StartLoggingMessage {
  /** Message type. */
  type: 'start-logging'
  /** Target tab identifier. */
  tabId: number
}

/**
 * Request to stop logging for a tab.
 */
export interface StopLoggingMessage {
  /** Message type. */
  type: 'stop-logging'
  /** Target tab identifier. */
  tabId: number
}

/**
 * Add a host to the always-log list.
 */
export interface AddAlwaysLogMessage {
  /** Message type. */
  type: 'add-always-log'
  /** Host name. */
  host: string
}

/**
 * Remove a host from the always-log list.
 */
export interface RemoveAlwaysLogMessage {
  /** Message type. */
  type: 'remove-always-log'
  /** Host name. */
  host: string
}

/**
 * Request the stored always-log hosts.
 */
export interface GetAlwaysLogHostsMessage {
  /** Message type. */
  type: 'get-always-log-hosts'
}

/**
 * Response containing all stored always-log hosts.
 */
export interface AlwaysLogHostsResponse {
  /** Message type. */
  type: 'always-log-hosts-response'
  /** Stored hosts. */
  hosts: AlwaysLogHost[]
}

/**
 * Tab capture state snapshot.
 */
export interface TabCaptureState {
  /** Current capture mode. */
  mode: CaptureMode
  /** Target tab identifier. */
  tabId: number
  /** Number of captured log entries. */
  logCount: number
  /** Whether the capture relay is connected. */
  connected: boolean
}

/**
 * Relay message emitted across the shared namespace.
 */
export interface LoggyRelayMessage {
  /** Shared message namespace. */
  type: typeof LOGGY_MESSAGE_NAMESPACE
  /** Relay source. */
  source: 'console' | 'network'
  /** Captured payload. */
  payload: CapturedConsoleEntry | CapturedNetworkEntry
}

/**
 * Capture payload message.
 */
export type CaptureMessage = ConsoleCaptureMessage | NetworkCaptureMessage

/**
 * Control message sent to the background capture pipeline.
 */
export type CaptureControlMessage =
  | GetStatusMessage
  | GetTabExportDataMessage
  | GetTabStatusMessage
  | ToggleDebuggerMessage
  | CachePreviewMessage
  | GetCachedPreviewMessage
  | PanelOpenedMessage
  | PanelClosedMessage
  | ContentRelayReadyMessage
  | RequestConsentMessage
  | ConsentResponseMessage
  | StartLoggingMessage
  | StopLoggingMessage
  | AddAlwaysLogMessage
  | RemoveAlwaysLogMessage
  | GetAlwaysLogHostsMessage
  | AlwaysLogHostsResponse
  | ConsentChangedMessage

/**
 * Background status message payloads.
 */
export type CaptureStatusMessage = StatusResponse | TabCaptureState

/**
 * All typed messages used by the background capture feature.
 */
export type LoggyMessage = CaptureMessage | CaptureControlMessage | LoggyRelayMessage

/**
 * Types compatible with the existing console and HAR model shapes.
 */
export type CapturedEntry = CapturedConsoleEntry | CapturedNetworkEntry | ConsoleMessage | HAREntry
