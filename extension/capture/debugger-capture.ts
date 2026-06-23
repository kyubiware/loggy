import type {
  CaptureMessage,
  CapturedConsoleEntry,
  CapturedNetworkEntry,
} from '../types/messages'
import { browser } from '../browser-apis'
import type { Debuggee } from '../browser-apis/types'

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
 * Attaches the debugger to a tab and enables Runtime + Network domains.
 */
export function attachToTab(tabId: number, callback?: OperationCallback): void {
  ensureListenersRegistered()

  if (attachedTabs.has(tabId)) {
    callback?.(new Error(`Debugger is already attached to tab ${tabId}`))
    return
  }

  const debuggee: Debuggee = { tabId }

  doAttach(debuggee, tabId, callback)
}

async function doAttach(
  debuggee: Debuggee,
  tabId: number,
  callback?: OperationCallback,
): Promise<void> {
  try {
    await browser.debugger.attach(debuggee, CDP_PROTOCOL_VERSION)
  } catch (error) {
    callback?.(mapDebuggerError(error, 'Failed to attach debugger', tabId))
    return
  }

  try {
    await browser.debugger.sendCommand(debuggee, 'Runtime.enable')
  } catch (error) {
    await detachAfterPartialAttach(tabId)
    callback?.(mapDebuggerError(error, 'Failed to enable Runtime domain', tabId))
    return
  }

  try {
    await browser.debugger.sendCommand(debuggee, 'Network.enable')
  } catch (error) {
    await detachAfterPartialAttach(tabId)
    callback?.(mapDebuggerError(error, 'Failed to enable Network domain', tabId))
    return
  }

  attachedTabs.add(tabId)
  callback?.()
}

/**
 * Detaches the debugger from a tab.
 */
export function detachFromTab(tabId: number, callback?: OperationCallback): void {
  const debuggee: Debuggee = { tabId }

  if (!attachedTabs.has(tabId)) {
    clearTabState(tabId)
    callback?.()
    return
  }

  doDetach(debuggee, tabId, callback)
}

async function doDetach(
  debuggee: Debuggee,
  tabId: number,
  callback?: OperationCallback,
): Promise<void> {
  try {
    await browser.debugger.detach(debuggee)
  } catch (error) {
    clearTabState(tabId)
    const err = error instanceof Error ? error : new Error(String(error))
    if (!isBenignDetachError(err.message)) {
      callback?.(err)
      return
    }
  }

  clearTabState(tabId)
  callback?.()
}

function ensureListenersRegistered(): void {
  if (listenersRegistered) return

  browser.debugger.onEvent.addListener(handleDebuggerEvent)
  browser.debugger.onDetach.addListener(handleDebuggerDetach)
  listenersRegistered = true
}

function handleDebuggerEvent(
  source: Debuggee,
  method: string,
  params?: object,
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

function handleDebuggerDetach(source: Debuggee): void {
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

async function handleLoadingFinished(tabId: number, params: NetworkLoadingFinishedEvent): Promise<void> {
  const requestId = params.requestId
  if (!requestId) return

  const tabRequests = getTabPendingRequests(tabId)
  const pendingRequest = tabRequests.get(requestId)
  if (!pendingRequest) return

  const responseBody = await getResponseBody(tabId, requestId)
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
}

async function getResponseBody(tabId: number, requestId: string): Promise<string | undefined> {
  const debuggee: Debuggee = { tabId }

  const timeoutPromise = new Promise<string | undefined>((resolve) => {
    setTimeout(() => resolve(undefined), RESPONSE_BODY_TIMEOUT_MS)
  })

  const bodyPromise: Promise<string | undefined> =
    browser.debugger.sendCommand(debuggee, 'Network.getResponseBody', { requestId })
      .then((result) => {
        const body = (result as { body?: unknown })?.body
        return typeof body === 'string' ? body : undefined
      })
      .catch(() => undefined)

  return Promise.race([bodyPromise, timeoutPromise])
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

async function detachAfterPartialAttach(tabId: number): Promise<void> {
  try {
    await browser.debugger.detach({ tabId })
  } catch {
    // Ignore detach errors during cleanup after a failed domain enable
  }
  clearTabState(tabId)
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

function mapDebuggerError(error: unknown, action: string, tabId: number): Error {
  const message = error instanceof Error ? error.message : String(error)

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
