/**
 * Tests for get-status auto-starting capture for always-log hosts.
 *
 * BUG: When the popup opens for a tab with an always-log host, it sometimes
 * shows the consent view instead of the settings view. On the second popup open
 * it works correctly.
 *
 * Root cause: The get-status handler returns raw in-memory tab state. If the tab
 * is inactive (service worker was sleeping, or content-relay-ready hasn't fired),
 * it returns mode='inactive' and the popup shows the consent view.
 *
 * Fix: get-status should evaluate consent for inactive tabs. If the host is in
 * the always-log list, auto-start capture before returning status.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MessageSender } from '../browser-apis/types'

// --- Mock dependencies (vi.mock is hoisted before everything) ---

const mockInjectIntoTab = vi.fn(() => Promise.resolve())
const mockIsHostInAlwaysLogList = vi.fn<(host: string) => Promise<boolean>>(
  () => Promise.resolve(false),
)
const mockGetAlwaysLogHosts = vi.fn(() => Promise.resolve([]))

vi.mock('./content-scripts', () => ({
  injectIntoTab: (...args: Parameters<typeof mockInjectIntoTab>) => mockInjectIntoTab(...args),
  registerAlwaysLogScriptsForHost: vi.fn(() => Promise.resolve()),
  unregisterAlwaysLogScriptsForHost: vi.fn(() => Promise.resolve()),
  syncAllAlwaysLogScripts: vi.fn(() => Promise.resolve()),
}))

vi.mock('../capture/debugger-capture', () => ({
  attachToTab: vi.fn(),
  detachFromTab: vi.fn(),
  isAttached: vi.fn(() => false),
  setCaptureCallback: vi.fn(),
}))

vi.mock('./storage', () => ({
  LOGGY_ALWAYS_LOG_HOSTS_KEY: 'loggy_always_log_hosts',
  addAlwaysLogHost: vi.fn(),
  getAlwaysLogHosts: (...args: Parameters<typeof mockGetAlwaysLogHosts>) =>
    mockGetAlwaysLogHosts(...args),
  isHostInAlwaysLogList: (...args: Parameters<typeof mockIsHostInAlwaysLogList>) =>
    mockIsHostInAlwaysLogList(...args),
  removeAlwaysLogHost: vi.fn(),
}))

// Break the browser-apis import chain
vi.mock('../shared/export', () => ({
  buildExportMarkdown: vi.fn(() => ''),
}))

// --- Listener capture arrays ---

type MessageListener = (
  message: unknown,
  sender: MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void

type TabActivatedListener = (activeInfo: { tabId: number }) => void

const onMessageListeners: MessageListener[] = []
const onActivatedListeners: TabActivatedListener[] = []

// --- Storage state ---

const localStorageState: Record<string, unknown> = {}
const sessionStorageState: Record<string, unknown> = {}

function setLocalStorageState(state: Record<string, unknown>): void {
  for (const key of Object.keys(localStorageState)) {
    delete localStorageState[key]
  }
  Object.assign(localStorageState, state)
}

// --- Tab mock state ---

let mockActiveTab: { id: number; url: string } | null = null

function setActiveTab(tab: { id: number; url: string } | null): void {
  mockActiveTab = tab
}

// --- Extend Chrome mocks and import module ---

beforeAll(() => {
  const c = globalThis.chrome as Record<string, unknown>

  c.storage = {
    local: {
      get: vi.fn(
        (
          _keys: string | string[] | null | undefined,
          callback?: (items: Record<string, unknown>) => void,
        ) => {
          if (callback) {
            callback({ ...localStorageState })
            return
          }
          return Promise.resolve({ ...localStorageState })
        },
      ),
      set: vi.fn(
        (items: Record<string, unknown>, callback?: () => void) => {
          Object.assign(localStorageState, items)
          if (callback) {
            callback()
            return
          }
          return Promise.resolve()
        },
      ),
    },
    session: {
      get: vi.fn(() => Promise.resolve({})),
      set: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    },
  }

  c.runtime = {
    onMessage: {
      addListener: vi.fn((fn: MessageListener) => {
        onMessageListeners.push(fn)
      }),
      removeListener: vi.fn(),
    },
    onConnect: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    sendMessage: vi.fn(),
  }

  const existingTabs = c.tabs as Record<string, unknown>
  c.tabs = {
    ...existingTabs,
    onRemoved: { addListener: vi.fn() },
    onActivated: {
      addListener: vi.fn((fn: TabActivatedListener) => {
        onActivatedListeners.push(fn)
      }),
    },
    onUpdated: { addListener: vi.fn() },
    sendMessage: vi.fn((_tabId: number, _message: unknown, callback?: (response: unknown) => void) => {
      if (callback) {
        callback({})
        return
      }
      return Promise.resolve({})
    }),
    get: vi.fn(() => {
      if (!mockActiveTab) {
        return Promise.resolve({})
      }
      return Promise.resolve(mockActiveTab)
    }),
  }

  c.action = { setIcon: vi.fn() }

  c.alarms = {
    create: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
    onAlarm: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  }

  // Dynamic import — module registers listeners with the extended mocks
  return import('./index')
})

afterAll(() => {
  vi.restoreAllMocks()
})

// --- Helpers ---

function sendMessage<T>(
  message: Record<string, unknown>,
  sender: Partial<MessageSender> = {},
): Promise<T> {
  return new Promise((resolve) => {
    const listener = onMessageListeners[0]
    if (!listener) {
      throw new Error('No onMessage listener registered')
    }
    listener(message, sender as MessageSender, (response: unknown) => {
      resolve(response as T)
    })
  })
}

function flushAsync(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function activateTab(tabId: number): void {
  for (const listener of onActivatedListeners) {
    listener({ tabId })
  }
}

// --- Tests ---

describe('get-status auto-starts capture for always-log hosts', () => {
  const ALWAYS_LOG_TAB_ID = 500
  const ALWAYS_LOG_HOST = 'example.com'
  const ALWAYS_LOG_URL = `https://${ALWAYS_LOG_HOST}/page`

  beforeEach(() => {
    mockInjectIntoTab.mockClear()
    mockIsHostInAlwaysLogList.mockClear()
    mockGetAlwaysLogHosts.mockClear()
    mockIsHostInAlwaysLogList.mockImplementation(() => Promise.resolve(false))
    mockGetAlwaysLogHosts.mockImplementation(() => Promise.resolve([]))

    // Reset storage state
    for (const key of Object.keys(localStorageState)) {
      delete localStorageState[key]
    }
    for (const key of Object.keys(sessionStorageState)) {
      delete sessionStorageState[key]
    }
  })

  it('returns inactive mode for a non-always-log host', async () => {
    setActiveTab({ id: ALWAYS_LOG_TAB_ID, url: 'https://random-site.org/page' })
    activateTab(ALWAYS_LOG_TAB_ID)

    const status = await sendMessage<{ mode: string }>({ type: 'get-status' })

    expect(status.mode).toBe('inactive')
    expect(mockInjectIntoTab).not.toHaveBeenCalled()
  })

  it('auto-starts capture when tab is inactive but host is in always-log list', async () => {
    // Setup: host is in always-log list
    mockIsHostInAlwaysLogList.mockImplementation((host: string) =>
      Promise.resolve(host === ALWAYS_LOG_HOST),
    )

    // The tab is inactive (default state), URL matches always-log host
    setActiveTab({ id: ALWAYS_LOG_TAB_ID, url: ALWAYS_LOG_URL })
    activateTab(ALWAYS_LOG_TAB_ID)

    // Act: get-status should detect always-log and auto-start
    const status = await sendMessage<{ mode: string; tabId: number }>({ type: 'get-status' })

    // Assert: mode should NOT be inactive — evaluateConsent returns 'debugger'
    // on Chrome (__BROWSER__='chrome' in tests) for always-log hosts
    expect(status.mode).not.toBe('inactive')
    expect(status.tabId).toBe(ALWAYS_LOG_TAB_ID)
  })

  it('injects content scripts when auto-starting for always-log host', async () => {
    const INJECT_TAB_ID = 501
    mockIsHostInAlwaysLogList.mockImplementation(() => Promise.resolve(true))
    // Use a localhost URL so evaluateConsent returns content-script mode
    // (non-local always-log hosts get 'debugger' mode on Chrome)
    const LOCAL_ALWAYS_LOG_URL = 'http://localhost:3000/page'
    setActiveTab({ id: INJECT_TAB_ID, url: LOCAL_ALWAYS_LOG_URL })
    activateTab(INJECT_TAB_ID)

    await sendMessage<{ mode: string }>({ type: 'get-status' })
    await flushAsync()

    expect(mockInjectIntoTab).toHaveBeenCalledWith(INJECT_TAB_ID)
  })

  it('returns active mode on second get-status call without re-evaluating consent', async () => {
    const DEDUP_TAB_ID = 502
    mockIsHostInAlwaysLogList.mockImplementation((host: string) =>
      Promise.resolve(host === ALWAYS_LOG_HOST),
    )
    setActiveTab({ id: DEDUP_TAB_ID, url: ALWAYS_LOG_URL })
    activateTab(DEDUP_TAB_ID)

    // First call: auto-starts capture
    const first = await sendMessage<{ mode: string }>({ type: 'get-status' })
    expect(first.mode).not.toBe('inactive')

    // Reset to track only subsequent calls
    mockIsHostInAlwaysLogList.mockClear()
    mockInjectIntoTab.mockClear()

    // Second call: tab is already active, should return immediately
    const second = await sendMessage<{ mode: string }>({ type: 'get-status' })
    expect(second.mode).not.toBe('inactive')

    // Should NOT re-evaluate consent since tab is already active
    expect(mockIsHostInAlwaysLogList).not.toHaveBeenCalled()
    expect(mockInjectIntoTab).not.toHaveBeenCalled()
  })

  it('auto-starts for localhost pages too (evaluateConsent grants consent for local pages)', async () => {
    const LOCALHOST_TAB_ID = 503
    setActiveTab({ id: LOCALHOST_TAB_ID, url: 'http://localhost:3000' })
    activateTab(LOCALHOST_TAB_ID)

    const status = await sendMessage<{ mode: string }>({ type: 'get-status' })

    // localhost is auto-consented by evaluateConsent — get-status correctly auto-starts
    expect(status.mode).not.toBe('inactive')
  })
})
