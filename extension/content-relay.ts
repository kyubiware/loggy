import type {
  CapturedConsoleEntry,
  CapturedNetworkEntry,
  CaptureMessage,
  CaptureMode,
  ConsentResponseMessage,
  ConsentState,
  ContentRelayReadyMessage,
  RequestConsentMessage,
} from './types/messages'

// Inlined to avoid ES module imports in the built content script
// (Firefox loads content_scripts as classic scripts, not modules)
const LOGGY_MESSAGE_NAMESPACE = '__LOGGY_RELAY__' as const

const MAX_QUEUE_SIZE = 50

type RelayOutboundMessage = CaptureMessage | ContentRelayReadyMessage
type ConsentChangedMessage = {
  type: 'consent-changed'
  hasConsent?: boolean
  captureMode?: CaptureMode | 'none'
}

type RelayEnvelope =
  | {
      type: typeof LOGGY_MESSAGE_NAMESPACE
      source: 'console'
      payload: CapturedConsoleEntry
    }
  | {
      type: typeof LOGGY_MESSAGE_NAMESPACE
      source: 'network'
      payload: CapturedNetworkEntry
    }

const messageQueue: RelayOutboundMessage[] = []
let isProcessingQueue = false
let consentPending = true
let consentGranted = false
let consentCaptureMode: CaptureMode | 'none' = 'none'
const consentBuffer: CaptureMessage[] = []

function toConsentState(response: unknown): ConsentState | null {
  if (!response || typeof response !== 'object') {
    return null
  }

  const direct = response as Partial<ConsentState>
  if (typeof direct.hasConsent === 'boolean' && typeof direct.captureMode === 'string') {
    return {
      hasConsent: direct.hasConsent,
      captureMode: direct.captureMode,
      reason: direct.reason,
    }
  }

  const nested = (response as { consent?: Partial<ConsentState> }).consent
  if (nested && typeof nested.hasConsent === 'boolean' && typeof nested.captureMode === 'string') {
    return {
      hasConsent: nested.hasConsent,
      captureMode: nested.captureMode,
      reason: nested.reason,
    }
  }

  const consentResponse = response as Partial<ConsentResponseMessage>
  if (
    consentResponse.type === 'consent-response' &&
    typeof consentResponse.hasConsent === 'boolean' &&
    typeof consentResponse.captureMode === 'string'
  ) {
    return {
      hasConsent: consentResponse.hasConsent,
      captureMode: consentResponse.captureMode,
      reason: consentResponse.reason,
    }
  }

  return null
}

function isContentRelayReadyMessage(
  message: RelayOutboundMessage
): message is ContentRelayReadyMessage {
  return 'type' in message && message.type === 'content-relay-ready'
}

function flushBuffer(): void {
  if (!(consentGranted && consentCaptureMode !== 'debugger')) {
    consentBuffer.length = 0
    return
  }

  while (consentBuffer.length > 0) {
    const message = consentBuffer.shift()
    if (!message) {
      continue
    }
    enqueueMessage(message)
  }
}

function handleConsentResponse(response: unknown): void {
  const consentState = toConsentState(response)
  if (!consentState) {
    return
  }

  consentPending = false
  consentGranted = consentState.hasConsent
  consentCaptureMode = consentState.captureMode

  if (consentGranted && consentCaptureMode !== 'debugger') {
    flushBuffer()
    return
  }

  consentBuffer.length = 0
}

function sendRuntimeMessage(message: RelayOutboundMessage): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response: unknown) => {
        if (isContentRelayReadyMessage(message)) {
          handleConsentResponse(response)
        }
        resolve(!chrome.runtime.lastError)
      })
    } catch {
      resolve(false)
    }
  })
}

function enqueueMessage(message: RelayOutboundMessage): void {
  if (messageQueue.length >= MAX_QUEUE_SIZE) {
    messageQueue.shift()
  }

  messageQueue.push(message)
  void drainQueue()
}

async function drainQueue(): Promise<void> {
  if (isProcessingQueue) {
    return
  }

  isProcessingQueue = true

  try {
    while (messageQueue.length > 0) {
      const message = messageQueue[0]
      const sent = await sendRuntimeMessage(message)

      if (!sent) {
        return
      }

      messageQueue.shift()
    }
  } finally {
    isProcessingQueue = false
  }
}

function isRelayEnvelope(data: unknown): data is RelayEnvelope {
  return Boolean(
    data &&
      typeof data === 'object' &&
      'type' in data &&
      (data as RelayEnvelope).type === LOGGY_MESSAGE_NAMESPACE &&
      'source' in data &&
      'payload' in data
  )
}

function handleRelayMessage(relayMessage: CaptureMessage): void {
  if (consentPending) {
    if (consentBuffer.length >= MAX_QUEUE_SIZE) {
      consentBuffer.shift()
    }
    consentBuffer.push(relayMessage)
    return
  }

  if (consentGranted && consentCaptureMode !== 'debugger') {
    enqueueMessage(relayMessage)
  }
}

function handleMessage(event: MessageEvent): void {
  if (event.source !== window) {
    return
  }

  if (!isRelayEnvelope(event.data)) {
    return
  }

  if (event.data.source === 'console') {
    const relayMessage: CaptureMessage = {
      source: 'console',
      payload: event.data.payload,
    }

    handleRelayMessage(relayMessage)
    return
  }

  const relayMessage: CaptureMessage = {
    source: 'network',
    payload: event.data.payload,
  }

  handleRelayMessage(relayMessage)
}

window.addEventListener('message', handleMessage)

chrome.runtime.onMessage.addListener((message: unknown) => {
  const consentMessage = message as ConsentChangedMessage
  if (consentMessage.type !== 'consent-changed') {
    return
  }

  handleConsentResponse({
    hasConsent: consentMessage.hasConsent ?? false,
    captureMode: consentMessage.captureMode ?? 'none',
  })
})

const requestConsentMessage: RequestConsentMessage = {
  type: 'request-consent',
  url: location.href,
}

try {
  chrome.runtime.sendMessage(requestConsentMessage, (response: unknown) => {
    if (chrome.runtime.lastError) {
      return
    }

    handleConsentResponse(response)
  })
} catch {
  // Ignore send failures. Queue/buffer handling keeps retries safe.
}

const readyMessage: ContentRelayReadyMessage = {
  type: 'content-relay-ready',
  url: location.href,
}

enqueueMessage(readyMessage)
