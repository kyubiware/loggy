import type {
  CaptureMessage,
  CapturedConsoleEntry,
  CapturedNetworkEntry,
} from '../types/messages'

type CaptureCallback = (tabId: number, message: CaptureMessage) => void
type OperationCallback = (error?: Error) => void

interface CdpRemoteObject {
  type?: string
  value?: unknown
  description?: string
  preview?: {
    description?: string
  }
}

interface RuntimeConsoleAPICalledEvent {
  type?: string
  args?: CdpRemoteObject[]
  timestamp?: number
}

interface NetworkRequestWillBeSentEvent {
  requestId?: string
  timestamp?: number
  request?: {
    url?: string
    method?: string
    headers?: Record<string, unknown>
    postData?: string
  }
}

interface NetworkResponseReceivedEvent {
  requestId?: string
  response?: {
    status?: number
    headers?: Record<string, unknown>
    mimeType?: string
  }
}

interface NetworkLoadingFinishedEvent {
  requestId?: string
  timestamp?: number
}

interface PendingRequest {
  url: string
  method: string
  requestHeaders?: Record<string, string>
  requestBody?: string
  requestStartedAt: number
  cdpStartTimestamp?: number
  status?: number
  responseHeaders?: Record<string, string>
  contentType?: string
}

const CDP_PROTOCOL_VERSION = '1.3'
const RESPONSE_BODY_TIMEOUT_MS = 1500

const attachedTabs = new Set<number>()
const pendingRequestsByTab = new Map<number, Map<string, PendingRequest>>()

let onCapture: CaptureCallback | null = null
let listenersRegistered = false

const consoleLevelMap: Record<string, CapturedConsoleEntry['level']> = {
  log: 'log',
  warning: 'warn',
  warn: 'warn',
  error: 'error',
  info: 'info',
  debug: 'debug',
  verbose: 'debug',
  clear: 'log',
}

/**
 * Registers a callback used to emit capture messages to the background worker.
 */
export function setCaptureCallback(callback: CaptureCallback): void {
  onCapture = callback
}

/**
 * Returns whether the debugger is currently attached for the tab.
 */
export function isAttached(tabId: number): boolean {
  return attachedTabs.has(tabId)
}

/**
 * Attaches chrome.debugger to a tab and enables Runtime + Network domains.
 */
export function attachToTab(tabId: number, callback?: OperationCallback): void {
  ensureListenersRegistered()

  if (attachedTabs.has(tabId)) {
    callback?.(new Error(`Debugger is already attached to tab ${tabId}`))
    return
  }

  const debuggee: chrome.debugger.Debuggee = { tabId }

  chrome.debugger.attach(debuggee, CDP_PROTOCOL_VERSION, () => {
    const attachError = getDebuggerError('Failed to attach debugger', tabId)

    if (attachError) {
      callback?.(attachError)
      return
    }

    chrome.debugger.sendCommand(debuggee, 'Runtime.enable', undefined, () => {
      const runtimeEnableError = getDebuggerError('Failed to enable Runtime domain', tabId)

      if (runtimeEnableError) {
        detachAfterPartialAttach(tabId, () => callback?.(runtimeEnableError))
        return
      }

      chrome.debugger.sendCommand(debuggee, 'Network.enable', undefined, () => {
        const networkEnableError = getDebuggerError('Failed to enable Network domain', tabId)

        if (networkEnableError) {
          detachAfterPartialAttach(tabId, () => callback?.(networkEnableError))
          return
        }

        attachedTabs.add(tabId)
        callback?.()
      })
    })
  })
}

/**
 * Detaches chrome.debugger from a tab.
 */
export function detachFromTab(tabId: number, callback?: OperationCallback): void {
  const debuggee: chrome.debugger.Debuggee = { tabId }

  if (!attachedTabs.has(tabId)) {
    clearTabState(tabId)
    callback?.()
    return
  }

  chrome.debugger.detach(debuggee, () => {
    const detachError = getDebuggerError('Failed to detach debugger', tabId)

    clearTabState(tabId)

    if (
      detachError &&
      !isBenignDetachError(detachError.message)
    ) {
      callback?.(detachError)
      return
    }

    callback?.()
  })
}

function ensureListenersRegistered(): void {
  if (listenersRegistered) return

  chrome.debugger.onEvent.addListener(handleDebuggerEvent)
  chrome.debugger.onDetach.addListener(handleDebuggerDetach)
  listenersRegistered = true
}

function handleDebuggerEvent(
  source: chrome.debugger.Debuggee,
  method: string,
  params?: object
): void {
  const tabId = source.tabId
  if (typeof tabId !== 'number') return
  if (!attachedTabs.has(tabId)) return

  if (method === 'Runtime.consoleAPICalled') {
    const entry = transformConsoleEvent(params as RuntimeConsoleAPICalledEvent)
    emit(tabId, { source: 'console', payload: entry })
    return
  }

  if (method === 'Network.requestWillBeSent') {
    handleRequestWillBeSent(tabId, params as NetworkRequestWillBeSentEvent)
    return
  }

  if (method === 'Network.responseReceived') {
    handleResponseReceived(tabId, params as NetworkResponseReceivedEvent)
    return
  }

  if (method === 'Network.loadingFinished') {
    handleLoadingFinished(tabId, params as NetworkLoadingFinishedEvent)
  }
}

function handleDebuggerDetach(source: chrome.debugger.Debuggee): void {
  const tabId = source.tabId
  if (typeof tabId !== 'number') return
  clearTabState(tabId)
}

function handleRequestWillBeSent(tabId: number, params: NetworkRequestWillBeSentEvent): void {
  const requestId = params.requestId
  if (!requestId) return

  const tabRequests = getTabPendingRequests(tabId)
  const requestHeaders = toHeaderRecord(params.request?.headers)

  tabRequests.set(requestId, {
    url: params.request?.url ?? '',
    method: params.request?.method ?? 'GET',
    requestHeaders,
    requestBody: params.request?.postData,
    requestStartedAt: Date.now(),
    cdpStartTimestamp: params.timestamp,
  })
}

function handleResponseReceived(tabId: number, params: NetworkResponseReceivedEvent): void {
  const requestId = params.requestId
  if (!requestId) return

  const tabRequests = getTabPendingRequests(tabId)
  const pendingRequest = tabRequests.get(requestId)
  if (!pendingRequest) return

  pendingRequest.status =
    typeof params.response?.status === 'number' ? params.response.status : 0
  pendingRequest.responseHeaders = toHeaderRecord(params.response?.headers)
  pendingRequest.contentType =
    typeof params.response?.mimeType === 'string' ? params.response.mimeType : undefined
}

function handleLoadingFinished(tabId: number, params: NetworkLoadingFinishedEvent): void {
  const requestId = params.requestId
  if (!requestId) return

  const tabRequests = getTabPendingRequests(tabId)
  const pendingRequest = tabRequests.get(requestId)
  if (!pendingRequest) return

  getResponseBody(tabId, requestId, (responseBody) => {
    const duration = computeDurationMs(pendingRequest, params.timestamp)

    const entry: CapturedNetworkEntry = {
      timestamp: new Date(pendingRequest.requestStartedAt).toISOString(),
      url: pendingRequest.url,
      method: pendingRequest.method,
      status: pendingRequest.status ?? 0,
      requestHeaders: pendingRequest.requestHeaders,
      requestBody: pendingRequest.requestBody,
      responseHeaders: pendingRequest.responseHeaders,
      responseBody,
      contentType: pendingRequest.contentType,
      duration,
    }

    emit(tabId, { source: 'network', payload: entry })
    tabRequests.delete(requestId)
  })
}

function getResponseBody(
  tabId: number,
  requestId: string,
  callback: (responseBody?: string) => void
): void {
  const debuggee: chrome.debugger.Debuggee = { tabId }
  let settled = false

  const timeoutId = setTimeout(() => {
    if (settled) return
    settled = true
    callback(undefined)
  }, RESPONSE_BODY_TIMEOUT_MS)

  chrome.debugger.sendCommand(
    debuggee,
    'Network.getResponseBody',
    { requestId },
    (result?: { body?: unknown; base64Encoded?: unknown }) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)

      if (chrome.runtime.lastError) {
        callback(undefined)
        return
      }

      const body = result?.body
      callback(typeof body === 'string' ? body : undefined)
    }
  )
}

function transformConsoleEvent(params: RuntimeConsoleAPICalledEvent): CapturedConsoleEntry {
  const rawType = typeof params.type === 'string' ? params.type : 'log'
  const level = consoleLevelMap[rawType] ?? 'log'
  const args = Array.isArray(params.args) ? params.args : []

  return {
    timestamp: toIsoTimestamp(params.timestamp),
    level,
    message: args.map(formatRemoteObject).join(' '),
  }
}

function formatRemoteObject(arg: CdpRemoteObject): string {
  if (arg.type === 'string') return typeof arg.value === 'string' ? arg.value : ''

  if (arg.type === 'number' || arg.type === 'boolean' || arg.type === 'bigint') {
    return String(arg.value)
  }

  if (arg.type === 'undefined') return 'undefined'
  if (arg.type === 'function') return '[Function]'

  if (arg.type === 'object') {
    if (arg.preview?.description) return arg.preview.description
    if (typeof arg.description === 'string') return arg.description

    try {
      return JSON.stringify(arg.value ?? {})
    } catch {
      return '[Object]'
    }
  }

  if (typeof arg.description === 'string') return arg.description
  if (arg.value !== undefined) return String(arg.value)
  return ''
}

function getTabPendingRequests(tabId: number): Map<string, PendingRequest> {
  const existing = pendingRequestsByTab.get(tabId)
  if (existing) return existing

  const created = new Map<string, PendingRequest>()
  pendingRequestsByTab.set(tabId, created)
  return created
}

function clearTabState(tabId: number): void {
  attachedTabs.delete(tabId)
  pendingRequestsByTab.delete(tabId)
}

function detachAfterPartialAttach(tabId: number, callback: () => void): void {
  chrome.debugger.detach({ tabId }, () => {
    clearTabState(tabId)
    callback()
  })
}

function emit(tabId: number, message: CaptureMessage): void {
  onCapture?.(tabId, message)
}

function toHeaderRecord(headers?: Record<string, unknown>): Record<string, string> | undefined {
  if (!headers) return undefined

  const normalized = Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key] = value
      return acc
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      acc[key] = String(value)
      return acc
    }

    return acc
  }, {})

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function computeDurationMs(pendingRequest: PendingRequest, endTimestamp?: number): number | undefined {
  if (typeof endTimestamp !== 'number' || typeof pendingRequest.cdpStartTimestamp !== 'number') {
    return Date.now() - pendingRequest.requestStartedAt
  }

  const start = pendingRequest.cdpStartTimestamp
  const end = endTimestamp

  if (start < 10_000_000 && end < 10_000_000) {
    return Math.max(0, Math.round((end - start) * 1000))
  }

  if (start > 1_000_000_000 && end > 1_000_000_000) {
    return Math.max(0, Math.round((end - start) * 1000))
  }

  return Math.max(0, Math.round(end - start))
}

function toIsoTimestamp(timestamp?: number): string {
  if (typeof timestamp !== 'number') {
    return new Date().toISOString()
  }

  if (timestamp > 1_000_000_000_000) {
    return new Date(timestamp).toISOString()
  }

  if (timestamp > 1_000_000_000) {
    return new Date(timestamp * 1000).toISOString()
  }

  return new Date().toISOString()
}

function getDebuggerError(action: string, tabId: number): Error | null {
  const message = chrome.runtime.lastError?.message
  if (!message) return null

  if (message.includes('Another debugger is already attached')) {
    return new Error(`Debugger already attached by another client for tab ${tabId}`)
  }

  if (message.includes('No tab with given id') || message.includes('No target with given id')) {
    return new Error(`Tab ${tabId} is not available (possibly closed)`)
  }

  if (message.toLowerCase().includes('permission')) {
    return new Error(`Debugger permission denied for tab ${tabId}`)
  }

  return new Error(`${action} for tab ${tabId}: ${message}`)
}

function isBenignDetachError(message: string): boolean {
  return message.includes('No tab with given id') || message.includes('No target with given id')
}
