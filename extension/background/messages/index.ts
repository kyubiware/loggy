import type { CaptureControlMessage, CaptureMessage } from '../../types/messages'
import { handleCaptureMessage } from './handle-capture'
import { handleGetStatus, handleGetTabStatus, handlePanelOpened, handlePanelClosed } from './tab-lifecycle'
import {
  handleToggleDebugger,
  handleContentRelayReady,
  handleStartLogging,
  handleStopLogging,
  handleRequestConsent,
  handleConsentResponse,
} from './capture-control'
import {
  handleAddAlwaysLog,
  handleRemoveAlwaysLog,
  handleGetAlwaysLogHosts,
} from './always-log'
import { handleGetTabExportData, handleClearTabData } from './export-handlers'
import {
  handleProbeServer,
  handlePushToServer,
  handleCachePreview,
  handleGetCachedPreview,
} from './server-preview'
import type { ControlMessageResult } from './types'

export { handleCaptureMessage } from './handle-capture'
export type { ControlMessageResult } from './types'

export async function handleControlMessage(
  message: CaptureControlMessage,
  sender: chrome.runtime.MessageSender,
): Promise<ControlMessageResult> {
  switch (message.type) {
    case 'get-status':
      return handleGetStatus(sender)

    case 'get-tab-status':
      return handleGetTabStatus(sender)

    case 'toggle-debugger':
      return handleToggleDebugger(message.tabId)

    case 'content-relay-ready':
      return handleContentRelayReady(message, sender)

    case 'panel-opened':
      return handlePanelOpened(message.tabId)

    case 'panel-closed':
      return handlePanelClosed(message.tabId)

    case 'get-tab-export-data':
      return handleGetTabExportData(message.tabId, message.selectedRoutes)

    case 'request-consent':
      return handleRequestConsent(message, sender)

    case 'consent-response':
      return handleConsentResponse(message)

    case 'start-logging':
      return handleStartLogging(message.tabId)

    case 'stop-logging':
      return handleStopLogging(message.tabId)

    case 'clear-tab-data':
      return handleClearTabData(message.tabId)

    case 'add-always-log':
      return handleAddAlwaysLog(message.host)

    case 'remove-always-log':
      return handleRemoveAlwaysLog(message.host)

    case 'get-always-log-hosts':
      return handleGetAlwaysLogHosts()

    case 'cache-preview':
      return handleCachePreview(message.markdown)

    case 'get-cached-preview':
      return handleGetCachedPreview(message.id)

    case 'probe-server':
      return handleProbeServer(message.url)

    case 'push-to-server':
      return handlePushToServer(message.url, message.markdown, sender.tab?.id)

    default:
      return { ok: false }
  }
}

export function isCaptureMessage(message: unknown): message is CaptureMessage {
  if (typeof message !== 'object' || message === null || !('source' in message)) {
    return false
  }

  const source = (message as { source?: unknown }).source
  return source === 'console' || source === 'network'
}

export function isControlMessage(message: unknown): message is CaptureControlMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false
  }

  const type = (message as { type?: unknown }).type
  return (
    type === 'get-status' ||
    type === 'get-tab-status' ||
    type === 'toggle-debugger' ||
    type === 'content-relay-ready' ||
    type === 'panel-opened' ||
    type === 'panel-closed' ||
    type === 'get-tab-export-data' ||
    type === 'request-consent' ||
    type === 'consent-response' ||
    type === 'start-logging' ||
    type === 'stop-logging' ||
    type === 'clear-tab-data' ||
    type === 'add-always-log' ||
    type === 'remove-always-log' ||
    type === 'cache-preview' ||
    type === 'get-cached-preview' ||
    type === 'get-always-log-hosts' ||
    type === 'always-log-hosts-response' ||
    type === 'probe-server' ||
    type === 'push-to-server'
  )
}
