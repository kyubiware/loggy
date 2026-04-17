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
 * Request to enable or disable debugger capture for a tab.
 */
export interface ToggleDebuggerMessage {
  /** Message type. */
  type: 'toggle-debugger'
  /** Target tab identifier. */
  tabId: number
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
  | ToggleDebuggerMessage
  | PanelOpenedMessage
  | PanelClosedMessage
  | ContentRelayReadyMessage

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
