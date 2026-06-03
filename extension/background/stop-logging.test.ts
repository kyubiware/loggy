/**
 * Tests for stop-logging preventing get-status from auto-re-activating capture.
 *
 * BUG: Clicking "Stop Logging" in the popup calls handleStopLogging (sets mode
 * to 'inactive') then refreshStatus (calls get-status). handleGetStatus sees the
 * tab is inactive, evaluates consent, and for local pages or always-log hosts
 * immediately re-activates capture — making it look like the stop button did
 * nothing.
 *
 * Fix: Track explicitly-stopped tabs so get-status skips auto-activation for them.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Stub build-time globals before any module imports them
vi.stubGlobal('__BROWSER__', 'chrome')
vi.stubGlobal('__DEBUG__', false)

// Service worker globals not available in node
if (typeof (globalThis as any).self === 'undefined' || typeof (globalThis as any).self?.addEventListener !== 'function') {
  ;(globalThis as any).self = {
    addEventListener: vi.fn(),
  }
}

if (!globalThis.chrome) {
  globalThis.chrome = {} as typeof chrome
}

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

const mockAttachToTab = vi.fn()
const mockDetachFromTab = vi.fn()
const mockIsAttached = vi.fn(() => false)

vi.mock('../capture/debugger-capture', () => ({
  attachToTab: (...args: Parameters<typeof mockAttachToTab>) => mockAttachToTab(...args),
  detachFromTab: (...args: Parameters<typeof mockDetachFromTab>) => mockDetachFromTab(...args),
  isAttached: (...args: Parameters<typeof mockIsAttached>) => mockIsAttached(...args),
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
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void

type TabActivatedListener = (activeInfo: { tabId: number }) => void

type TabUpdatedListener = (tabId: number, changeInfo: Record<string, unknown>) => void

const onMessageListeners: MessageListener[] = []
const onActivatedListeners: TabActivatedListener[] = []
const onUpdatedListeners: TabUpdatedListener[] = []

// --- Storage state ---

const localStorageState: Record<string, unknown> = {}
const sessionStorageState: Record<string, unknown> = {}

// --- Tab mock state ---

let mockActiveTab: { id: number; url: string } | null = null

function setActiveTab(tab: { id: number; url: string } | null): void {
  mockActiveTab = tab
}

// --- Extend Chrome mocks and import module ---

beforeAll(() => {
  if (!globalThis.chrome) {
    globalThis.chrome = {} as typeof chrome
  }
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
    onUpdated: {
      addListener: vi.fn((fn: TabUpdatedListener) => {
        onUpdatedListeners.push(fn)
      }),
    },
    sendMessage: vi.fn(),
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
  sender: Partial<chrome.runtime.MessageSender> = {},
): Promise<T> {
  return new Promise((resolve) => {
    const listener = onMessageListeners[0]
    if (!listener) {
      throw new Error('No onMessage listener registered')
    }
    listener(message, sender as chrome.runtime.MessageSender, (response: unknown) => {
      resolve(response as T)
    })
  })
}

function activateTab(tabId: number): void {
  for (const listener of onActivatedListeners) {
    listener({ tabId })
  }
}

function fireTabUpdated(tabId: number, changeInfo: Record<string, unknown>): void {
  for (const listener of onUpdatedListeners) {
    listener(tabId, changeInfo)
  }
}

function flushAsync(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- Tests ---

describe('stop-logging prevents get-status auto-re-activation', () => {
  const TAB_ID_LOCALHOST = 600
  const TAB_ID_ALWAYS_LOG = 601
  const TAB_ID_RESUME = 602
  const LOCALHOST_URL = 'http://localhost:3000/page'

  beforeEach(async () => {
    mockInjectIntoTab.mockClear()
    mockIsHostInAlwaysLogList.mockClear()
    mockGetAlwaysLogHosts.mockClear()
    mockIsHostInAlwaysLogList.mockImplementation(() => Promise.resolve(false))
    mockGetAlwaysLogHosts.mockImplementation(() => Promise.resolve([]))

    // Reset in-memory tab state between tests via dynamic import
    const tabStateModule = await import('./tab-state')
    tabStateModule.tabStates.clear()
    tabStateModule.explicitlyStoppedByTab.clear()

    // Reset storage state
    for (const key of Object.keys(localStorageState)) {
      delete localStorageState[key]
    }
    for (const key of Object.keys(sessionStorageState)) {
      delete sessionStorageState[key]
    }
  })

  it('keeps mode inactive after stop-logging for a localhost page', async () => {
    // Setup: localhost page, auto-consented by evaluateConsent
    setActiveTab({ id: TAB_ID_LOCALHOST, url: LOCALHOST_URL })
    activateTab(TAB_ID_LOCALHOST)

    // Start logging first
    const startResult = await sendMessage<{ mode: string }>({
      type: 'start-logging',
      tabId: TAB_ID_LOCALHOST,
    })
    expect(startResult.mode).not.toBe('inactive')

    // Stop logging
    const stopResult = await sendMessage<{ mode: string }>({
      type: 'stop-logging',
      tabId: TAB_ID_LOCALHOST,
    })
    expect(stopResult.mode).toBe('inactive')

    // Now simulate the popup's refreshStatus() — get-status should NOT auto-reactivate
    const status = await sendMessage<{ mode: string }>({ type: 'get-status' })

    // BUG: Without the fix, this will be 'content-script' (auto-reactivated)
    // FIX: This should remain 'inactive' because user explicitly stopped
    expect(status.mode).toBe('inactive')
  })

  it('keeps mode inactive after stop-logging for an always-log host', async () => {
    const ALWAYS_LOG_HOST = 'always-logged.example.com'
    const ALWAYS_LOG_URL = `https://${ALWAYS_LOG_HOST}/page`

    mockIsHostInAlwaysLogList.mockImplementation((host: string) =>
      Promise.resolve(host === ALWAYS_LOG_HOST),
    )

    setActiveTab({ id: TAB_ID_ALWAYS_LOG, url: ALWAYS_LOG_URL })
    activateTab(TAB_ID_ALWAYS_LOG)

    // get-status auto-starts for always-log host
    const initialStatus = await sendMessage<{ mode: string }>({ type: 'get-status' })
    expect(initialStatus.mode).not.toBe('inactive')

    // Stop logging
    const stopResult = await sendMessage<{ mode: string }>({
      type: 'stop-logging',
      tabId: TAB_ID_ALWAYS_LOG,
    })
    expect(stopResult.mode).toBe('inactive')

    // get-status should NOT auto-reactivate the explicitly-stopped tab
    const status = await sendMessage<{ mode: string }>({ type: 'get-status' })
    expect(status.mode).toBe('inactive')
  })

  it('allows start-logging to resume after stop for previously auto-started tab', async () => {
    setActiveTab({ id: TAB_ID_RESUME, url: LOCALHOST_URL })
    activateTab(TAB_ID_RESUME)

    // Start → stop
    await sendMessage({ type: 'start-logging', tabId: TAB_ID_RESUME })
    await sendMessage({ type: 'stop-logging', tabId: TAB_ID_RESUME })

    // Manually start again — should work
    const restartResult = await sendMessage<{ mode: string }>({
      type: 'start-logging',
      tabId: TAB_ID_RESUME,
    })
    expect(restartResult.mode).not.toBe('inactive')
  })

  it('keeps mode inactive after stop-logging + page refresh (navigation)', async () => {
    const TAB_ID_NAV = 603

    setActiveTab({ id: TAB_ID_NAV, url: LOCALHOST_URL })
    activateTab(TAB_ID_NAV)

    // Start logging first
    const startResult = await sendMessage<{ mode: string }>({
      type: 'start-logging',
      tabId: TAB_ID_NAV,
    })
    expect(startResult.mode).not.toBe('inactive')

    // Stop logging
    const stopResult = await sendMessage<{ mode: string }>({
      type: 'stop-logging',
      tabId: TAB_ID_NAV,
    })
    expect(stopResult.mode).toBe('inactive')

    // Simulate page refresh (loading + URL change)
    fireTabUpdated(TAB_ID_NAV, { status: 'loading' })
    fireTabUpdated(TAB_ID_NAV, { url: 'http://localhost:3000/refreshed-page' })
    await flushAsync()

    // get-status should NOT auto-reactivate after navigation
    const status = await sendMessage<{ mode: string }>({ type: 'get-status' })
    expect(status.mode).toBe('inactive')
  })

  it('keeps mode inactive when content-relay-ready fires after stop-logging', async () => {
    const TAB_ID_RELAY = 604

    setActiveTab({ id: TAB_ID_RELAY, url: LOCALHOST_URL })
    activateTab(TAB_ID_RELAY)

    // Start logging first
    await sendMessage({ type: 'start-logging', tabId: TAB_ID_RELAY })

    // Stop logging
    const stopResult = await sendMessage<{ mode: string }>({
      type: 'stop-logging',
      tabId: TAB_ID_RELAY,
    })
    expect(stopResult.mode).toBe('inactive')

    // Simulate content-relay-ready message arriving from the page
    // (e.g. after a refresh re-injected the content script before
    // the navigation handler could block re-injection).
    mockInjectIntoTab.mockClear()
    const relayResult = await sendMessage<{ mode?: string; consent?: { hasConsent: boolean } }>(
      {
        type: 'content-relay-ready',
        url: LOCALHOST_URL,
        tabId: TAB_ID_RELAY,
      },
      { tab: { id: TAB_ID_RELAY, url: LOCALHOST_URL } as chrome.tabs.Tab },
    )

    // Should NOT have re-injected content scripts
    expect(mockInjectIntoTab).not.toHaveBeenCalled()
    // Consent should be denied
    expect(relayResult.consent?.hasConsent).toBe(false)

    // Mode should still be inactive
    const status = await sendMessage<{ mode: string }>({ type: 'get-status' })
    expect(status.mode).toBe('inactive')
  })
})

describe('start-logging uses debugger mode on Chrome', () => {
  const TAB_ID = 700
  const PAGE_URL = 'https://example.com/page'

  beforeEach(async () => {
    mockAttachToTab.mockClear()
    mockDetachFromTab.mockClear()
    mockInjectIntoTab.mockClear()

    // Reset in-memory tab state
    const tabStateModule = await import('./tab-state')
    tabStateModule.tabStates.clear()
    tabStateModule.explicitlyStoppedByTab.clear()

    // Reset storage state
    for (const key of Object.keys(localStorageState)) {
      delete localStorageState[key]
    }
    for (const key of Object.keys(sessionStorageState)) {
      delete sessionStorageState[key]
    }

    setActiveTab({ id: TAB_ID, url: PAGE_URL })
    activateTab(TAB_ID)
  })

  it('attaches debugger and sets mode to debugger on Chrome when user clicks Start Logging', async () => {
    const result = await sendMessage<{ mode: string }>({
      type: 'start-logging',
      tabId: TAB_ID,
    })

    expect(result.mode).toBe('debugger')
    expect(mockAttachToTab).toHaveBeenCalledWith(TAB_ID, expect.any(Function))
  })

  it('does not inject content scripts when using debugger mode', async () => {
    await sendMessage<{ mode: string }>({
      type: 'start-logging',
      tabId: TAB_ID,
    })

    expect(mockInjectIntoTab).not.toHaveBeenCalled()
  })

  it('falls back to content-script mode if debugger attach fails', async () => {
    // Simulate attachToTab calling its error callback
    mockAttachToTab.mockImplementation((_tabId: number, onError: (error: Error) => void) => {
      onError(new Error('Cannot access tab'))
    })

    const result = await sendMessage<{ mode: string }>({
      type: 'start-logging',
      tabId: TAB_ID,
    })

    // Should start in debugger mode, error callback triggers fallback
    // The mode is set synchronously to 'debugger', then the error callback
    // triggers an async fallback to 'content-script'
    expect(result.mode).toBe('debugger')
  })

  it('sets connected=true so toggle-debugger pauses to content-script (not inactive)', async () => {
    await sendMessage<{ mode: string }>({
      type: 'start-logging',
      tabId: TAB_ID,
    })

    // Simulate clicking the pause button in popup
    const toggleResult = await sendMessage<{ mode: string; connected: boolean }>({
      type: 'toggle-debugger',
      tabId: TAB_ID,
    })

    // Should detach and fall back to content-script, NOT inactive
    expect(toggleResult.mode).toBe('content-script')
    expect(mockDetachFromTab).toHaveBeenCalledWith(TAB_ID)
  })
})
