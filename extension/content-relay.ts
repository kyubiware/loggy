import type {
  CapturedConsoleEntry,
  CapturedNetworkEntry,
  CaptureMessage,
  ContentRelayReadyMessage,
} from './types/messages'
import { LOGGY_MESSAGE_NAMESPACE } from './types/messages'

const MAX_QUEUE_SIZE = 50

type RelayOutboundMessage = CaptureMessage | ContentRelayReadyMessage
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

function sendRuntimeMessage(message: RelayOutboundMessage): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, () => {
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

    enqueueMessage(relayMessage)
    return
  }

  const relayMessage: CaptureMessage = {
    source: 'network',
    payload: event.data.payload,
  }

  enqueueMessage(relayMessage)
}

window.addEventListener('message', handleMessage)

const readyMessage: ContentRelayReadyMessage = {
  type: 'content-relay-ready',
  url: location.href,
}

enqueueMessage(readyMessage)
