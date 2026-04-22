import { buildExportMarkdown } from '../panel/export'
import { getFilteredPanelData } from '../panel/filtered-data'
import {
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  createInitialState,
  mergePersistedSettings,
} from '../panel/state'
import {
  attachToTab,
  detachFromTab,
  isAttached as isDebuggerAttached,
  setCaptureCallback,
} from '../capture/debugger-capture'
import {
  LOGGY_ALWAYS_LOG_HOSTS_KEY,
  addAlwaysLogHost,
  getAlwaysLogHosts,
  isHostInAlwaysLogList,
  removeAlwaysLogHost,
} from './storage'
import type { ConsoleMessage } from '../types/console'
import type { HAREntry, HARHeader } from '../types/har'
import {
  LOGGY_MESSAGE_NAMESPACE,
  type AddAlwaysLogMessage,
  type AlwaysLogHost,
  type AlwaysLogHostsResponse,
  type CapturedConsoleEntry,
  type CapturedNetworkEntry,
  type CaptureControlMessage,
  type CaptureMessage,
  type CaptureMode,
  type ConsentResponseMessage,
  type ConsentState,
  type GetAlwaysLogHostsMessage,
  type LoggyMessage,
  type RemoveAlwaysLogMessage,
  type RequestConsentMessage,
  type StartLoggingMessage,
  type StatusResponse,
  type StopLoggingMessage,
  type TabExportDataResponse,
  type TabCaptureState,
} from '../types/messages'
import { formatMarkdown } from '../utils/formatter'
import { isLocalPage } from '../utils/is-local-page'
import { estimateTokenCount } from '../utils/token-estimate'

declare const __BROWSER__: string

const DEFAULT_SERVER_URL = 'http://localhost:8743'
const EXPORT_PATH = '/loggy'
const STORAGE_KEY_PREFIX = 'loggy_capture_'
const FAILED_EXPORT_BUFFER_KEY_PREFIX = 'loggy_failed_export_'
const TAB_STATES_STORAGE_KEY = 'loggy_tab_capture_states'
const MAX_ENTRIES_PER_TAB = 1000
const MAX_FAILED_EXPORT_BUFFER = 20

type StoredCapturedEntry =
  | { kind: 'console'; entry: CapturedConsoleEntry }
  | { kind: 'network'; entry: CapturedNetworkEntry }

interface StoredPanelSettings {
  serverUrl?: string
}

const tabStates = new Map<number, TabCaptureState>()
const previousModeByTab = new Map<number, CaptureMode>()
const debuggerResumeTimersByTab = new Map<number, ReturnType<typeof setTimeout>>()
let activeTabId: number | null = null

function createDefaultTabState(tabId: number): TabCaptureState {
  return {
    mode: 'inactive',
    tabId,
    logCount: 0,
    connected: false,
  }
}

function getStorageKeyForTab(tabId: number): string {
  return `${STORAGE_KEY_PREFIX}${tabId}`
}

function getFailedBufferStorageKeyForTab(tabId: number): string {
  return `${FAILED_EXPORT_BUFFER_KEY_PREFIX}${tabId}`
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function toHeadersMap(headers?: Record<string, string>): HARHeader[] | undefined {
  if (!headers) {
    return undefined
  }

  const mapped = Object.entries(headers).map(([name, value]) => ({ name, value }))
  return mapped.length > 0 ? mapped : undefined
}

function toConsoleMessage(entry: CapturedConsoleEntry): ConsoleMessage {
  return {
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
  }
}

function toHAREntry(entry: CapturedNetworkEntry): HAREntry {
  return {
    startedDateTime: entry.timestamp,
    time: entry.duration,
    request: {
      url: entry.url,
      method: entry.method,
      headers: toHeadersMap(entry.requestHeaders),
      postData:
        typeof entry.requestBody === 'string'
          ? {
              text: entry.requestBody,
              mimeType: entry.contentType,
            }
          : undefined,
    },
    response: {
      status: entry.status,
      statusText: '',
      headers: toHeadersMap(entry.responseHeaders),
      content:
        typeof entry.responseBody === 'string' || typeof entry.contentType === 'string'
          ? {
              text: entry.responseBody,
              mimeType: entry.contentType,
            }
          : undefined,
    },
  }
}

function getOrCreateTabState(tabId: number): TabCaptureState {
  const existing = tabStates.get(tabId)
  if (existing) {
    return existing
  }

  const created = createDefaultTabState(tabId)
  tabStates.set(tabId, created)
  return created
}

function persistTabStates(): Promise<void> {
  const serialized = Object.fromEntries(tabStates.entries())
  return chrome.storage.session.set({ [TAB_STATES_STORAGE_KEY]: serialized })
}

async function setTabState(state: TabCaptureState): Promise<void> {
  tabStates.set(state.tabId, state)
  await persistTabStates()
}

export async function setMode(tabId: number, mode: CaptureMode): Promise<TabCaptureState> {
  const current = getOrCreateTabState(tabId)
  const next: TabCaptureState = {
    ...current,
    mode,
  }

  await setTabState(next)
  return next
}

export function getMode(tabId: number): CaptureMode {
  return tabStates.get(tabId)?.mode ?? 'inactive'
}

async function evaluateConsent(tabId: number, url: string): Promise<ConsentState> {
  if (isLocalPage(url)) {
    return { hasConsent: true, captureMode: 'content-script', reason: 'local-page' }
  }

  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname

    if (await isHostInAlwaysLogList(host)) {
      const mode: CaptureMode = __BROWSER__ === 'chrome' ? 'debugger' : 'content-script'
      return { hasConsent: true, captureMode: mode, reason: 'always-log' }
    }
  } catch {
    // Invalid URL — no consent
  }

  const current = getOrCreateTabState(tabId)
  if (current.mode !== 'inactive' && current.connected) {
    return { hasConsent: true, captureMode: current.mode, reason: 'per-session' }
  }

  return { hasConsent: false, captureMode: 'none', reason: 'no-consent' }
}

function updateIconForTab(tabId: number): void {
  const state = tabStates.get(tabId)
  const isActive = state && state.mode !== 'inactive'

  const iconPath = isActive
    ? {
        16: 'icons/icon16-active.png',
        48: 'icons/icon48-active.png',
        128: 'icons/icon128-active.png',
      }
    : { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }

  chrome.action.setIcon({ tabId, path: iconPath })
}

export function getActiveTabStatus(): StatusResponse {
  if (activeTabId === null) {
    return {
      mode: 'inactive',
      tabId: -1,
      logCount: 0,
      connected: false,
    }
  }

  const state = tabStates.get(activeTabId)
  if (!state) {
    return {
      mode: 'inactive',
      tabId: activeTabId,
      logCount: 0,
      connected: false,
    }
  }

  return {
    mode: state.mode,
    tabId: state.tabId,
    logCount: state.logCount,
    connected: state.connected,
  }
}

async function readStoredEntries(tabId: number): Promise<StoredCapturedEntry[]> {
  const key = getStorageKeyForTab(tabId)
  const result = (await chrome.storage.session.get(key)) as Record<string, unknown>
  const raw = result[key]

  if (!Array.isArray(raw)) {
    return []
  }

  return raw as StoredCapturedEntry[]
}

async function writeStoredEntries(tabId: number, entries: StoredCapturedEntry[]): Promise<void> {
  const key = getStorageKeyForTab(tabId)
  await chrome.storage.session.set({ [key]: entries })
}

async function storeCapturedData(tabId: number, data: CaptureMessage): Promise<number> {
  const entries = await readStoredEntries(tabId)
  const nextEntry: StoredCapturedEntry =
    data.source === 'console'
      ? { kind: 'console', entry: data.payload as CapturedConsoleEntry }
      : { kind: 'network', entry: data.payload as CapturedNetworkEntry }

  const next = [...entries, nextEntry]
  const bounded = next.length > MAX_ENTRIES_PER_TAB ? next.slice(-MAX_ENTRIES_PER_TAB) : next

  await writeStoredEntries(tabId, bounded)
  return bounded.length
}

async function getServerUrl(): Promise<string> {
  const result = (await chrome.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
    string,
    unknown
  >
  const settings = result[LOGGY_PANEL_SETTINGS_STORAGE_KEY] as StoredPanelSettings | undefined

  if (typeof settings?.serverUrl === 'string' && settings.serverUrl.length > 0) {
    return settings.serverUrl
  }

  return DEFAULT_SERVER_URL
}

async function getTabUrl(tabId: number): Promise<string> {
  try {
    const tab = await chrome.tabs.get(tabId)
    return tab.url ?? 'unknown://tab'
  } catch {
    return 'unknown://tab'
  }
}

async function buildTabMarkdown(tabId: number): Promise<string> {
  const entries = await readStoredEntries(tabId)
  const consoleLogs: ConsoleMessage[] = []
  const networkEntries: HAREntry[] = []

  for (const stored of entries) {
    if (stored.kind === 'console') {
      consoleLogs.push(toConsoleMessage(stored.entry))
      continue
    }

    networkEntries.push(toHAREntry(stored.entry))
  }

  return formatMarkdown({
    url: await getTabUrl(tabId),
    timestamp: new Date().toISOString(),
    includeAgentContext: true,
    includeResponseBodies: true,
    truncateConsoleLogs: true,
    consoleLogs,
    networkEntries,
  })
}

async function appendFailedExportBuffer(tabId: number, markdown: string): Promise<void> {
  const key = getFailedBufferStorageKeyForTab(tabId)
  const result = (await chrome.storage.session.get(key)) as Record<string, unknown>
  const existingRaw = result[key]
  const existing = Array.isArray(existingRaw)
    ? (existingRaw.filter((entry) => typeof entry === 'string') as string[])
    : []

  const deduped = existing.length > 0 && existing[existing.length - 1] === markdown
  const next = deduped ? existing : [...existing, markdown]
  const bounded =
    next.length > MAX_FAILED_EXPORT_BUFFER ? next.slice(-MAX_FAILED_EXPORT_BUFFER) : next
  await chrome.storage.session.set({ [key]: bounded })
}

async function clearFailedExportBuffer(tabId: number): Promise<void> {
  const key = getFailedBufferStorageKeyForTab(tabId)
  await chrome.storage.session.remove(key)
}

async function pushToServer(url: string, markdown: string): Promise<boolean> {
  try {
    const response = await fetch(`${normalizeBaseUrl(url)}${EXPORT_PATH}`, {
      method: 'POST',
      body: markdown,
      headers: {
        'Content-Type': 'text/plain',
      },
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      console.error(`[Loggy] Server export failed: HTTP ${response.status} ${response.statusText}`)
      return false
    }

    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      console.error('[Loggy] Server export failed: Request timed out after 3s')
    } else if (error instanceof TypeError) {
      console.error(`[Loggy] Server export failed: Network error - ${error.message}`)
    } else {
      console.error('[Loggy] Server export failed:', error)
    }

    return false
  }
}

async function exportTabToServer(tabId: number): Promise<boolean> {
  const markdown = await buildTabMarkdown(tabId)
  const serverUrl = await getServerUrl()
  const success = await pushToServer(serverUrl, markdown)

  if (success) {
    await clearFailedExportBuffer(tabId)
    return true
  }

  await appendFailedExportBuffer(tabId, markdown)
  return false
}

async function handleCaptureMessage(
  tabId: number,
  message: CaptureMessage,
  source: 'content-script' | 'debugger'
): Promise<void> {
  const current = getOrCreateTabState(tabId)

  if (current.mode === 'devtools') {
    return
  }

  if (current.mode === 'debugger' && source !== 'debugger') {
    return
  }

  const logCount = await storeCapturedData(tabId, message)

  const nextMode: CaptureMode =
    source === 'debugger'
      ? 'debugger'
      : current.mode === 'inactive'
        ? 'content-script'
        : current.mode
  const next: TabCaptureState = {
    ...current,
    mode: nextMode,
    connected: true,
    logCount,
  }

  await setTabState(next)
  await exportTabToServer(tabId)
}

async function handleControlMessage(
  message: CaptureControlMessage,
  sender: chrome.runtime.MessageSender
): Promise<
  | StatusResponse
  | TabCaptureState
  | (TabCaptureState & { consent: ConsentState })
  | TabExportDataResponse
  | ConsentState
  | ConsentResponseMessage
  | AlwaysLogHostsResponse
  | { ok: boolean }
> {
  if (message.type === 'get-status') {
    return getActiveTabStatus()
  }

  if (message.type === 'toggle-debugger') {
    const current = getOrCreateTabState(message.tabId)

    if (current.mode === 'devtools') {
      return { ...current, mode: current.mode }
    }

    const pendingResume = debuggerResumeTimersByTab.get(message.tabId)
    if (pendingResume) {
      clearTimeout(pendingResume)
      debuggerResumeTimersByTab.delete(message.tabId)
    }

    if (current.mode === 'debugger') {
      detachFromTab(message.tabId)
      const updated = await setMode(
        message.tabId,
        current.connected ? 'content-script' : 'inactive'
      )
      return updated
    }

    attachToTab(message.tabId, (error) => {
      if (error) {
        console.error('[Loggy] Failed to attach debugger:', error.message)
        void setMode(message.tabId, 'content-script')
      }
    })
    const updated = await setMode(message.tabId, 'debugger')
    return updated
  }

  if (message.type === 'content-relay-ready') {
    const tabId = message.tabId ?? sender.tab?.id
    if (typeof tabId !== 'number') {
      return { ok: false }
    }

    const url = message.url || (sender.tab?.url ?? '')
    const consent = await evaluateConsent(tabId, url)

    if (consent.hasConsent) {
      const current = getOrCreateTabState(tabId)
      const updated: TabCaptureState = {
        ...current,
        connected: true,
        mode:
          consent.captureMode === 'debugger'
            ? 'debugger'
            : current.mode === 'inactive'
              ? 'content-script'
              : current.mode,
      }
      await setTabState(updated)
      updateIconForTab(tabId)

      if (consent.captureMode === 'debugger' && consent.reason === 'always-log') {
        attachToTab(tabId, (error) => {
          if (error) {
            console.error('[Loggy] Failed to attach debugger for always-log:', error.message)
            void setMode(tabId, 'content-script')
          }
        })
      }

      return { ...updated, consent }
    }

    const current = getOrCreateTabState(tabId)
    const updated: TabCaptureState = {
      ...current,
      connected: true,
    }
    await setTabState(updated)
    return { ...updated, consent }
  }

  if (message.type === 'panel-opened') {
    const current = getOrCreateTabState(message.tabId)

    if (current.mode !== 'devtools') {
      previousModeByTab.set(message.tabId, current.mode)
    }

    const pendingResume = debuggerResumeTimersByTab.get(message.tabId)
    if (pendingResume) {
      clearTimeout(pendingResume)
      debuggerResumeTimersByTab.delete(message.tabId)
    }

    if (isDebuggerAttached(message.tabId)) {
      detachFromTab(message.tabId)
    }

    const updated: TabCaptureState = {
      ...current,
      mode: 'devtools',
      connected: true,
    }
    await setTabState(updated)
    return updated
  }

  if (message.type === 'panel-closed') {
    const previousMode = previousModeByTab.get(message.tabId) ?? null
    previousModeByTab.delete(message.tabId)
    const current = getOrCreateTabState(message.tabId)

    const pendingResume = debuggerResumeTimersByTab.get(message.tabId)
    if (pendingResume) {
      clearTimeout(pendingResume)
      debuggerResumeTimersByTab.delete(message.tabId)
    }

    if (previousMode === 'debugger') {
      const resumeTimer = setTimeout(() => {
        const latest = getOrCreateTabState(message.tabId)
        if (latest.mode === 'devtools') {
          return
        }

        attachToTab(message.tabId, (error) => {
          if (error) {
            console.error('[Loggy] Failed to re-attach debugger:', error.message)
            const fallbackState = getOrCreateTabState(message.tabId)
            void setMode(message.tabId, fallbackState.connected ? 'content-script' : 'inactive')
            return
          }
          void setMode(message.tabId, 'debugger')
        })

        debuggerResumeTimersByTab.delete(message.tabId)
      }, 2000)

      debuggerResumeTimersByTab.set(message.tabId, resumeTimer)

      const updated: TabCaptureState = {
        ...current,
        mode: current.connected ? 'content-script' : 'inactive',
      }
      await setTabState(updated)
      return updated
    }

    const updated: TabCaptureState = {
      ...current,
      mode: current.connected ? 'content-script' : 'inactive',
    }
    await setTabState(updated)
    return updated
  }

  if (message.type === 'get-tab-export-data') {
    const entries = await readStoredEntries(message.tabId)
    const consoleLogs: ConsoleMessage[] = []
    const networkEntries: HAREntry[] = []

    for (const stored of entries) {
      if (stored.kind === 'console') {
        consoleLogs.push(toConsoleMessage(stored.entry))
        continue
      }

      networkEntries.push(toHAREntry(stored.entry))
    }

    const defaults = createInitialState()
    const settingsResult = (await chrome.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
      string,
      unknown
    >
    const persistedSettings = mergePersistedSettings(
      settingsResult[LOGGY_PANEL_SETTINGS_STORAGE_KEY],
      {
        consoleFilter: defaults.consoleFilter,
        networkFilter: defaults.networkFilter,
        consoleVisible: defaults.consoleVisible,
        networkVisible: defaults.networkVisible,
        includeAgentContext: defaults.includeAgentContext,
        includeResponseBodies: defaults.includeResponseBodies,
        truncateConsoleLogs: defaults.truncateConsoleLogs,
        redactSensitiveInfo: defaults.redactSensitiveInfo,
        networkExportEnabled: defaults.networkExportEnabled,
        autoServerSync: defaults.autoServerSync,
        serverUrl: defaults.serverUrl,
      }
    )

    const state = {
      ...defaults,
      ...persistedSettings,
      consoleLogs,
      networkEntries,
    }

    const filteredData = getFilteredPanelData(state)
    const markdown = await buildExportMarkdown(state)
    const tokenCount = estimateTokenCount(markdown)

    return {
      tokenCount,
      markdown,
      hasData: filteredData.consoleLogs.length > 0 || filteredData.networkEntries.length > 0,
      logCount: filteredData.consoleLogs.length + filteredData.networkEntries.length,
    }
  }

  if (message.type === 'request-consent') {
    const request: RequestConsentMessage = message
    const tabId = sender.tab?.id
    if (typeof tabId !== 'number') {
      return { hasConsent: false, captureMode: 'none' as const, reason: 'unknown-tab' }
    }

    const url = request.url || (sender.tab?.url ?? '')
    return evaluateConsent(tabId, url)
  }

  if (message.type === 'consent-response') {
    const response: ConsentResponseMessage = message
    return response
  }

  if (message.type === 'start-logging') {
    const startMessage: StartLoggingMessage = message
    const tabId = startMessage.tabId
    const current = getOrCreateTabState(tabId)

    if (current.mode === 'devtools') {
      return { ...current }
    }

    const updated = await setMode(tabId, 'content-script')
    updateIconForTab(tabId)

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'consent-changed',
        hasConsent: true,
        captureMode: 'content-script',
      })
    } catch {
      // Content script may not be loaded yet
    }

    return updated
  }

  if (message.type === 'stop-logging') {
    const stopMessage: StopLoggingMessage = message
    const tabId = stopMessage.tabId
    const current = getOrCreateTabState(tabId)

    if (current.mode === 'devtools') {
      return { ...current }
    }

    if (current.mode === 'debugger' && isDebuggerAttached(tabId)) {
      detachFromTab(tabId)
    }

    const updated = await setMode(tabId, 'inactive')
    updateIconForTab(tabId)

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'consent-changed',
        hasConsent: false,
        captureMode: 'none',
      })
    } catch {
      // Content script may not be loaded
    }

    return updated
  }

  if (message.type === 'add-always-log') {
    const addMessage: AddAlwaysLogMessage = message
    await addAlwaysLogHost(addMessage.host)

    try {
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (typeof tab.id !== 'number' || !tab.url) {
          continue
        }

        try {
          const parsedUrl = new URL(tab.url)
          if (parsedUrl.hostname === addMessage.host) {
            const consent = await evaluateConsent(tab.id, tab.url)
            if (consent.hasConsent) {
              const current = getOrCreateTabState(tab.id)
              if (current.mode === 'inactive') {
                await setMode(tab.id, 'content-script')
                updateIconForTab(tab.id)

                try {
                  await chrome.tabs.sendMessage(tab.id, {
                    type: 'consent-changed',
                    hasConsent: true,
                    captureMode: 'content-script',
                  })
                } catch {
                  // Content script may not be loaded
                }
              }
            }
          }
        } catch {
          // Invalid URL
        }
      }
    } catch {
      // Failed to query tabs
    }

    return { ok: true }
  }

  if (message.type === 'remove-always-log') {
    const removeMessage: RemoveAlwaysLogMessage = message
    await removeAlwaysLogHost(removeMessage.host)

    try {
      const tabs = await chrome.tabs.query({})
      for (const tab of tabs) {
        if (typeof tab.id !== 'number' || !tab.url) {
          continue
        }

        try {
          const parsedUrl = new URL(tab.url)
          if (parsedUrl.hostname === removeMessage.host) {
            const consent = await evaluateConsent(tab.id, tab.url)
            if (!consent.hasConsent) {
              const current = getOrCreateTabState(tab.id)
              if (current.mode !== 'devtools' && current.mode !== 'inactive') {
                if (current.mode === 'debugger' && isDebuggerAttached(tab.id)) {
                  detachFromTab(tab.id)
                }

                await setMode(tab.id, 'inactive')
                updateIconForTab(tab.id)

                try {
                  await chrome.tabs.sendMessage(tab.id, {
                    type: 'consent-changed',
                    hasConsent: false,
                    captureMode: 'none',
                  })
                } catch {
                  // Content script may not be loaded
                }
              }
            }
          }
        } catch {
          // Invalid URL
        }
      }
    } catch {
      // Failed to query tabs
    }

    return { ok: true }
  }

  if (message.type === 'get-always-log-hosts') {
    const getAlwaysLogHostsMessage: GetAlwaysLogHostsMessage = message
    const hosts: AlwaysLogHost[] = await getAlwaysLogHosts()
    void getAlwaysLogHostsMessage
    return { type: 'always-log-hosts-response', hosts } as AlwaysLogHostsResponse
  }

  return { ok: false }
}

function isCaptureMessage(message: unknown): message is CaptureMessage {
  if (typeof message !== 'object' || message === null || !('source' in message)) {
    return false
  }

  const source = (message as { source?: unknown }).source
  return source === 'console' || source === 'network'
}

function isControlMessage(message: unknown): message is CaptureControlMessage {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return false
  }

  const type = (message as { type?: unknown }).type
  return (
    type === 'get-status' ||
    type === 'toggle-debugger' ||
    type === 'content-relay-ready' ||
    type === 'panel-opened' ||
    type === 'panel-closed' ||
    type === 'get-tab-export-data' ||
    type === 'request-consent' ||
    type === 'consent-response' ||
    type === 'start-logging' ||
    type === 'stop-logging' ||
    type === 'add-always-log' ||
    type === 'remove-always-log' ||
    type === 'get-always-log-hosts' ||
    type === 'always-log-hosts-response'
  )
}

async function restoreTabStatesFromStorage(): Promise<void> {
  const result = (await chrome.storage.session.get(TAB_STATES_STORAGE_KEY)) as Record<string, unknown>
  const stored = result[TAB_STATES_STORAGE_KEY]

  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return
  }

  for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
    const tabId = Number.parseInt(key, 10)
    if (!Number.isFinite(tabId)) {
      continue
    }

    const state = value as Partial<TabCaptureState>
    if (
      (state.mode === 'content-script' ||
        state.mode === 'debugger' ||
        state.mode === 'devtools' ||
        state.mode === 'inactive') &&
      typeof state.tabId === 'number' &&
      typeof state.logCount === 'number' &&
      typeof state.connected === 'boolean'
    ) {
      tabStates.set(tabId, {
        mode: state.mode,
        tabId: state.tabId,
        logCount: state.logCount,
        connected: state.connected,
      })
    }
  }
}

async function restoreLogCountsFromStorage(): Promise<void> {
  const all = (await chrome.storage.session.get(null)) as Record<string, unknown>

  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(STORAGE_KEY_PREFIX)) {
      continue
    }

    const tabId = Number.parseInt(key.slice(STORAGE_KEY_PREFIX.length), 10)
    if (!Number.isFinite(tabId) || !Array.isArray(value)) {
      continue
    }

    const current = getOrCreateTabState(tabId)
    current.logCount = value.length
    tabStates.set(tabId, current)
  }

  await persistTabStates()
}

async function refreshActiveTabId(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    activeTabId = tabs[0]?.id ?? null
  } catch {
    activeTabId = null
  }
}

async function initialize(): Promise<void> {
  setCaptureCallback((tabId: number, message: CaptureMessage) => {
    void handleCaptureMessage(tabId, message, 'debugger')
  })

  await restoreTabStatesFromStorage()
  await restoreLogCountsFromStorage()
  await refreshActiveTabId()

  if (activeTabId !== null) {
    updateIconForTab(activeTabId)
  }

  await chrome.storage.local.get(LOGGY_ALWAYS_LOG_HOSTS_KEY)
}

chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
  const message = rawMessage as LoggyMessage

  void (async () => {
    try {
      if (
        typeof message === 'object' &&
        message !== null &&
        'type' in message &&
        (message as { type?: unknown }).type === LOGGY_MESSAGE_NAMESPACE &&
        isCaptureMessage(message)
      ) {
        const tabId = sender.tab?.id
        if (typeof tabId === 'number') {
          await handleCaptureMessage(tabId, message, 'content-script')
          sendResponse({ ok: true })
          return
        }
      }

      if (isCaptureMessage(message)) {
        const tabId = sender.tab?.id
        if (typeof tabId === 'number') {
          await handleCaptureMessage(tabId, message, 'content-script')
          sendResponse({ ok: true })
          return
        }

        sendResponse({ ok: false })
        return
      }

      if (isControlMessage(message)) {
        const response = await handleControlMessage(message, sender)
        sendResponse(response)
        return
      }

      sendResponse({ ok: false })
    } catch (error) {
      console.error('[Loggy] Background message handler failed:', error)
      sendResponse({ ok: false })
    }
  })()

  return true
})

chrome.tabs.onRemoved.addListener((tabId) => {
  const pendingResume = debuggerResumeTimersByTab.get(tabId)
  if (pendingResume) {
    clearTimeout(pendingResume)
    debuggerResumeTimersByTab.delete(tabId)
  }

  if (isDebuggerAttached(tabId)) {
    detachFromTab(tabId)
  }

  previousModeByTab.delete(tabId)
  tabStates.delete(tabId)
  if (activeTabId === tabId) {
    activeTabId = null
  }

  void (async () => {
    await persistTabStates()
    await chrome.storage.session.remove(getStorageKeyForTab(tabId))
    await chrome.storage.session.remove(getFailedBufferStorageKeyForTab(tabId))
  })()
})

chrome.tabs.onActivated.addListener((activeInfo) => {
  activeTabId = activeInfo.tabId
  updateIconForTab(activeInfo.tabId)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // Only react to URL changes (SPA navigation or full page navigation)
  if (!changeInfo.url) {
    return
  }

  const url = changeInfo.url
  void (async () => {
    try {
      const consent = await evaluateConsent(tabId, url)

      if (consent.hasConsent) {
        // Host changed to a consented host — start capture if not already active
        const current = getOrCreateTabState(tabId)
        if (current.mode === 'inactive') {
          const captureMode =
            consent.captureMode === 'debugger' ? 'debugger' : 'content-script'
          await setMode(tabId, captureMode)
          updateIconForTab(tabId)

          if (captureMode === 'debugger') {
            attachToTab(tabId, (error) => {
              if (error) {
                console.error('[Loggy] Failed to attach debugger for SPA nav:', error.message)
                void setMode(tabId, 'content-script')
              }
            })
          }

          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'consent-changed',
              hasConsent: true,
              captureMode,
            })
          } catch {
            // Content script may not be loaded
          }
        }
      } else {
        // Host changed to a non-consented host — stop capture if active
        const current = getOrCreateTabState(tabId)
        if (current.mode !== 'inactive' && current.mode !== 'devtools') {
          if (current.mode === 'debugger' && isDebuggerAttached(tabId)) {
            detachFromTab(tabId)
          }
          await setMode(tabId, 'inactive')
          updateIconForTab(tabId)

          try {
            await chrome.tabs.sendMessage(tabId, {
              type: 'consent-changed',
              hasConsent: false,
              captureMode: 'none',
            })
          } catch {
            // Content script may not be loaded
          }
        }
      }
    } catch (error) {
      console.error('[Loggy] SPA navigation consent re-evaluation failed:', error)
    }
  })()
})

chrome.runtime.onInstalled.addListener(() => {
  void initialize()
})

chrome.runtime.onStartup.addListener(() => {
  void initialize()
})

self.addEventListener('activate', () => {
  void initialize()
})

void initialize()
