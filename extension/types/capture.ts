import type { ConsoleLevel } from './console.ts'

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
 * Capture payload message.
 */
export type CaptureMessage = ConsoleCaptureMessage | NetworkCaptureMessage

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
