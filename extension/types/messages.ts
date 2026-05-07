// Capture types

export { LOGGY_MESSAGE_NAMESPACE } from './capture.js'
export type {
  CapturedConsoleEntry,
  CapturedNetworkEntry,
  CaptureMessage,
  CaptureMode,
  ConsoleCaptureMessage,
  LoggyRelayMessage,
  NetworkCaptureMessage,
} from './capture.ts'

// Control messages
export type {
  AddAlwaysLogMessage,
  CachePreviewMessage,
  CaptureControlMessage,
  ConsentChangedMessage,
  ConsentResponseMessage,
  ContentRelayReadyMessage,
  GetAlwaysLogHostsMessage,
  GetCachedPreviewMessage,
  GetStatusMessage,
  GetTabExportDataMessage,
  GetTabStatusMessage,
  PanelClosedMessage,
  PanelOpenedMessage,
  RemoveAlwaysLogMessage,
  RequestConsentMessage,
  StartLoggingMessage,
  StopLoggingMessage,
  ToggleDebuggerMessage,
} from './control.ts'

// Response types
export type {
  AlwaysLogHost,
  AlwaysLogHostsResponse,
  CachedPreviewResponse,
  CachePreviewResponse,
  CaptureStatusMessage,
  ConsentState,
  StatusResponse,
  TabCaptureState,
  TabExportDataResponse,
} from './responses.ts'

import type {
  CapturedConsoleEntry,
  CapturedNetworkEntry,
  CaptureMessage,
  LoggyRelayMessage,
} from './capture.ts'
// Union types that span modules
import type { ConsoleMessage } from './console.ts'
import type { CaptureControlMessage } from './control.ts'
import type { HAREntry } from './har.ts'

/**
 * All typed messages used by the background capture feature.
 */
export type LoggyMessage = CaptureMessage | CaptureControlMessage | LoggyRelayMessage

/**
 * Types compatible with the existing console and HAR model shapes.
 */
export type CapturedEntry = CapturedConsoleEntry | CapturedNetworkEntry | ConsoleMessage | HAREntry
