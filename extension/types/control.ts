import type { CaptureMode } from './capture.ts'
import type { AlwaysLogHostsResponse } from './responses.ts'

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
 * Request to probe a loggy-serve endpoint for availability.
 */
export interface ProbeServerMessage {
  /** Message type. */
  type: 'probe-server'
  /** Server URL to probe. */
  url: string
}

/**
 * Request to push markdown export to a loggy-serve endpoint.
 */
export interface PushToServerMessage {
  /** Message type. */
  type: 'push-to-server'
  /** Server URL. */
  url: string
  /** Markdown content to export. */
  markdown: string
}

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
  | ProbeServerMessage
  | PushToServerMessage
