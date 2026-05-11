/**
 * Tests for panel lifecycle capture continuity.
 *
 * BUG: On Firefox, the extension doesn't capture logs unless the DevTools panel is open.
 * Root cause: When the panel closes, mode falls back to 'content-script' but content scripts
 * are never injected. When a tab navigates in content-script mode, content scripts are lost
 * but never re-injected.
 *
 * These tests verify:
 * 1. panel-closed → injects content scripts when falling back to content-script mode
 * 2. tabs.onUpdated → re-injects content scripts on navigation for content-script mode tabs
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// --- Mock dependencies (vi.mock is hoisted before everything) ---

const mockInjectIntoTab = vi.fn(() => Promise.resolve())

vi.mock('./content-scripts', () => ({
  injectIntoTab: (...args: Parameters<typeof mockInjectIntoTab>) => mockInjectIntoTab(...args),
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
  getAlwaysLogHosts: vi.fn(() => Promise.resolve([])),
  isHostInAlwaysLogList: vi.fn(() => Promise.resolve(false)),
  removeAlwaysLogHost: vi.fn(),
}))

// Break the browser-apis import chain (shared/export → browser-apis/index uses __BROWSER__)
vi.mock('../shared/export', () => ({
  buildExportMarkdown: vi.fn(() => ''),
}))

// --- Listener capture arrays ---

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void

type TabUpdatedListener = (tabId: number, changeInfo: Record<string, unknown>) => void

const onMessageListeners: MessageListener[] = []
const onUpdatedListeners: TabUpdatedListener[] = []

// --- Extend Chrome mocks and import module (in beforeAll, after mocks are ready) ---

beforeAll(() => {
  const c = globalThis.chrome as Record<string, unknown>

  c.storage = {
    local: (c.storage as Record<string, unknown>)?.local,
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
    onActivated: { addListener: vi.fn() },
    onUpdated: {
      addListener: vi.fn((fn: TabUpdatedListener) => {
        onUpdatedListeners.push(fn)
      }),
    },
    sendMessage: vi.fn(),
    get: vi.fn(() => Promise.resolve({ id: 1, url: 'http://localhost:3000' })),
  }

  c.action = { setIcon: vi.fn() }

  // Dynamic import — module registers listeners with the extended mocks
  return import('./index')
})

// --- Helpers ---

function sendControlMessage<T>(
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

function fireTabUpdated(tabId: number, changeInfo: Record<string, unknown>): void {
  for (const listener of onUpdatedListeners) {
    listener(tabId, changeInfo)
  }
}

function flushAsync(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- Tests ---

describe('panel-closed handler', () => {
  const TAB_ID = 100

  beforeEach(() => {
    mockInjectIntoTab.mockClear()
  })

  it('injects content scripts when mode falls back to content-script', async () => {
    // Setup: Open panel → sets mode to devtools, connected=true
    await sendControlMessage({ type: 'panel-opened', tabId: TAB_ID })

    // Act: Close panel → should fall back to content-script and INJECT
    await sendControlMessage({ type: 'panel-closed', tabId: TAB_ID })

    // Assert: injectIntoTab was called for this tab
    expect(mockInjectIntoTab).toHaveBeenCalledWith(TAB_ID)
  })

  it('does not inject content scripts when mode falls back to inactive (not connected)', async () => {
    // Use a fresh tab that was never connected
    const DISCONNECTED_TAB = 101

    // Get the tab state initialized (default: connected=false)
    await sendControlMessage(
      { type: 'get-tab-status' },
      { tab: { id: DISCONNECTED_TAB, url: 'http://localhost:3000' } as chrome.tabs.Tab },
    )

    // Act: Close panel for a tab that wasn't connected
    await sendControlMessage({ type: 'panel-closed', tabId: DISCONNECTED_TAB })

    // Assert: injectIntoTab should NOT be called (mode falls back to inactive)
    expect(mockInjectIntoTab).not.toHaveBeenCalledWith(DISCONNECTED_TAB)
  })

  it('sends consent-changed message to the tab after injection', async () => {
    const c = globalThis.chrome as Record<string, unknown>
    const tabsSendMessage = (c.tabs as Record<string, unknown>).sendMessage as ReturnType<
      typeof vi.fn
    >

    // Setup: Open and close panel
    await sendControlMessage({ type: 'panel-opened', tabId: TAB_ID })
    await sendControlMessage({ type: 'panel-closed', tabId: TAB_ID })

    // Assert: consent-changed message was sent to the tab
    expect(tabsSendMessage).toHaveBeenCalledWith(
      TAB_ID,
      expect.objectContaining({
        type: 'consent-changed',
        hasConsent: true,
        captureMode: 'content-script',
      }),
    )
  })
})

describe('tabs.onUpdated handler — content-script re-injection', () => {
  const TAB_ID = 200

  beforeEach(() => {
    mockInjectIntoTab.mockClear()
  })

  it('re-injects content scripts on navigation when tab is in content-script mode', async () => {
    // Setup: Put tab into content-script mode via start-logging
    await sendControlMessage({ type: 'start-logging', tabId: TAB_ID })

    // Clear the mock after setup so we only count re-injection calls
    mockInjectIntoTab.mockClear()

    // Act: Simulate navigation (URL change) to a localhost page (always consented)
    fireTabUpdated(TAB_ID, { url: 'http://localhost:3000/new-page' })
    await flushAsync()

    // Assert: injectIntoTab was called again to re-inject after navigation
    expect(mockInjectIntoTab).toHaveBeenCalledWith(TAB_ID)
  })

  it('does not re-inject when mode is devtools (panel is open)', async () => {
    // Setup: Open panel → sets mode to devtools
    await sendControlMessage({ type: 'panel-opened', tabId: TAB_ID })
    mockInjectIntoTab.mockClear()

    // Act: Navigate
    fireTabUpdated(TAB_ID, { url: 'http://localhost:3000/another-page' })
    await flushAsync()

    // Assert: No injection — devtools mode handles its own capture
    expect(mockInjectIntoTab).not.toHaveBeenCalledWith(TAB_ID)
  })
})
