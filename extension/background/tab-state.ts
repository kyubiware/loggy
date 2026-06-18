import type { TabCaptureState, CaptureMode, StatusResponse } from '../types/messages'
import { debugLog } from '../utils/debug-logger'

export const STORAGE_KEY_PREFIX = 'loggy_capture_'
export const TAB_STATES_STORAGE_KEY = 'loggy_tab_capture_states'
export const EXPLICITLY_STOPPED_STORAGE_KEY = 'loggy_explicitly_stopped_tabs'

export const tabStates = new Map<number, TabCaptureState>()
export const previousModeByTab = new Map<number, CaptureMode>()
export const debuggerResumeTimersByTab = new Map<number, ReturnType<typeof setTimeout>>()
export const explicitlyStoppedByTab = new Set<number>()
/**
 * Tabs that have seen a `changeInfo.url` event (navigation start) but not yet
 * a `changeInfo.status === 'loading'` event. Used by the loading handler to
 * distinguish navigation (URL changed → always preserve logs) from refresh
 * (same URL → clear if preserveLogs=false).
 *
 * Unlike a committed-URL Map, this Set is reliable even after service worker
 * restarts because Chrome fires the url event before the loading event and
 * keeps the SW alive between them.
 */
export const pendingNavigationByTab = new Set<number>()
export let activeTabId: number | null = null

export function setActiveTabId(id: number | null): void {
  activeTabId = id
}

export function createDefaultTabState(tabId: number): TabCaptureState {
  return {
    mode: 'inactive',
    tabId,
    logCount: 0,
    connected: false,
  }
}

export function getStorageKeyForTab(tabId: number): string {
  return `${STORAGE_KEY_PREFIX}${tabId}`
}

export function getOrCreateTabState(tabId: number): TabCaptureState {
  const existing = tabStates.get(tabId)
  if (existing) {
    return existing
  }

  const created = createDefaultTabState(tabId)
  tabStates.set(tabId, created)
  return created
}

export function persistTabStates(): Promise<void> {
  const serialized = Object.fromEntries(tabStates.entries())
  return chrome.storage.session.set({ [TAB_STATES_STORAGE_KEY]: serialized })
}

export function persistExplicitlyStoppedTabs(): Promise<void> {
  return chrome.storage.session.set({
    [EXPLICITLY_STOPPED_STORAGE_KEY]: Array.from(explicitlyStoppedByTab),
  })
}

export async function markTabExplicitlyStopped(tabId: number): Promise<void> {
  explicitlyStoppedByTab.add(tabId)
  await persistExplicitlyStoppedTabs()
}

export async function unmarkTabExplicitlyStopped(tabId: number): Promise<void> {
  explicitlyStoppedByTab.delete(tabId)
  await persistExplicitlyStoppedTabs()
}

export async function restoreExplicitlyStoppedTabsFromStorage(): Promise<void> {
  const result = (await chrome.storage.session.get(EXPLICITLY_STOPPED_STORAGE_KEY)) as Record<
    string,
    unknown
  >
  const stored = result[EXPLICITLY_STOPPED_STORAGE_KEY]
  if (!Array.isArray(stored)) {
    return
  }
  for (const value of stored) {
    const tabId = Number(value)
    if (Number.isFinite(tabId)) {
      explicitlyStoppedByTab.add(tabId)
    }
  }
}

export async function setTabState(state: TabCaptureState): Promise<void> {
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
  debugLog('capture', 'background', `Mode changed to ${mode}`, { tabId })
  return next
}

export function getMode(tabId: number): CaptureMode {
  return tabStates.get(tabId)?.mode ?? 'inactive'
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

export function updateIconForTab(tabId: number): void {
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

export async function restoreTabStatesFromStorage(): Promise<void> {
  const result = (await chrome.storage.session.get(TAB_STATES_STORAGE_KEY)) as Record<
    string,
    unknown
  >
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

export async function restoreLogCountsFromStorage(): Promise<void> {
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

export async function refreshActiveTabId(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    activeTabId = tabs[0]?.id ?? null
  } catch {
    activeTabId = null
  }
}
