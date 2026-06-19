/**
 * Tests for the clear-tab-data message handler.
 *
 * Verifies that clearing tab data:
 * - Removes stored session entries
 * - Clears page-level capture arrays (__loggyConsoleLogs, __loggyNetworkLogs)
 * - Executes the page-clearing script in the MAIN world (not isolated)
 *   so it reaches the same arrays that console-bootstrap.mjs writes to
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// Service worker globals not available in jsdom — stub before module import
if (typeof (globalThis as any).self === 'undefined' || typeof (globalThis as any).self?.addEventListener !== 'function') {
  ;(globalThis as any).self = {
    addEventListener: vi.fn(),
  }
}

if (!globalThis.chrome) {
  globalThis.chrome = {} as typeof chrome
}

// --- Mock dependencies (vi.mock is hoisted before everything) ---

vi.mock('./content-scripts', () => ({
  injectIntoTab: vi.fn(() => Promise.resolve()),
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
  getAlwaysLogHosts: vi.fn(() => Promise.resolve([])),
  isHostInAlwaysLogList: vi.fn(() => Promise.resolve(false)),
  removeAlwaysLogHost: vi.fn(),
}))

vi.mock('../shared/export', () => ({
  buildExportMarkdown: vi.fn(() => ''),
}))

// --- Listener capture ---

type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
) => boolean | void

const onMessageListeners: MessageListener[] = []

// --- Storage state ---

const localStorageState: Record<string, unknown> = {}
const sessionStorageState: Record<string, unknown> = {}

// --- Scripting mock ---

const mockScriptingExecuteScript = vi.fn(() => Promise.resolve([]))

// --- Setup ---

beforeAll(() => {
  const c = globalThis.chrome as Record<string, unknown>

  c.storage = {
    local: {
      get: vi.fn((keys: string | string[] | null | undefined, callback?: (items: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {}
        const keyList = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : []
        for (const key of keyList) {
          if (key in localStorageState) {
            result[key] = localStorageState[key]
          }
        }
        if (callback) {
          callback(result)
          return
        }
        return Promise.resolve(result)
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(localStorageState, items)
        if (callback) {
          callback()
          return
        }
        return Promise.resolve()
      }),
    },
    session: {
      get: vi.fn((keys: string | string[] | Record<string, unknown> | null | undefined, callback?: (items: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {}
        const keyList = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : []
        for (const key of keyList) {
          if (key in sessionStorageState) {
            result[key] = sessionStorageState[key]
          }
        }
        if (callback) {
          callback(result)
          return
        }
        return Promise.resolve(result)
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(sessionStorageState, items)
        if (callback) {
          callback()
          return
        }
        return Promise.resolve()
      }),
      remove: vi.fn((_keys: string | string[], callback?: () => void) => {
        const keyList = typeof _keys === 'string' ? [_keys] : Array.isArray(_keys) ? _keys : []
        for (const key of keyList) {
          delete sessionStorageState[key]
        }
        if (callback) {
          callback()
          return
        }
        return Promise.resolve()
      }),
    },
  }

  c.runtime = {
    onMessage: {
      addListener: vi.fn((fn: MessageListener) => {
        onMessageListeners.push(fn)
      }),
    },
    onConnect: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    onStartup: { addListener: vi.fn() },
    sendMessage: vi.fn(),
  }

  c.tabs = {
    query: vi.fn(() => Promise.resolve([{ id: 1, url: 'http://localhost:3000' }])),
    onRemoved: { addListener: vi.fn() },
    onActivated: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    sendMessage: vi.fn(),
    get: vi.fn(() => Promise.resolve({ id: 1, url: 'http://localhost:3000' })),
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

  c.scripting = {
    executeScript: mockScriptingExecuteScript,
  } as unknown as typeof chrome.scripting

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

// --- Tests ---

describe('clear-tab-data', () => {
  const TAB_ID = 400

  beforeEach(() => {
    mockScriptingExecuteScript.mockClear()
    for (const key of Object.keys(localStorageState)) {
      delete localStorageState[key]
    }
    for (const key of Object.keys(sessionStorageState)) {
      delete sessionStorageState[key]
    }
  })

  it('returns ok: true', async () => {
    const response = await sendMessage<{ ok: boolean }>({
      type: 'clear-tab-data',
      tabId: TAB_ID,
    })
    expect(response).toEqual({ ok: true })
  })

  it('removes stored session entries for the tab', async () => {
    const entry = { kind: 'console', entry: { level: 'log', message: 'hello' } }
    sessionStorageState[`loggy_capture_${TAB_ID}`] = [entry]

    await sendMessage({ type: 'clear-tab-data', tabId: TAB_ID })

    expect(sessionStorageState[`loggy_capture_${TAB_ID}`]).toBeUndefined()
  })

  it('clears page-level capture arrays in the MAIN world', async () => {
    await sendMessage({ type: 'clear-tab-data', tabId: TAB_ID })

    expect(mockScriptingExecuteScript).toHaveBeenCalledTimes(1)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const calls = (mockScriptingExecuteScript as any).mock.calls as Array<Array<{ target: { tabId: number }; world?: string; func: () => void }>>
    const call = calls[0]?.[0]

    expect(call.target.tabId).toBe(TAB_ID)
    expect(call.world).toBe('MAIN')
  })

  it('tolerates scripting errors (e.g. chrome:// pages)', async () => {
    mockScriptingExecuteScript.mockRejectedValueOnce(new Error('Not allowed'))

    const response = await sendMessage<{ ok: boolean }>({
      type: 'clear-tab-data',
      tabId: TAB_ID,
    })

    expect(response).toEqual({ ok: true })
  })
})
