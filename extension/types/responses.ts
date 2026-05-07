import type { CaptureMode } from './capture.ts'

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
 * Background status message payloads.
 */
export type CaptureStatusMessage = StatusResponse | TabCaptureState
