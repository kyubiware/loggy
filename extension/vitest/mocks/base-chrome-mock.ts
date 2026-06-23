/**
 * Shared base chrome mock factory.
 *
 * Creates a complete `chrome`-shaped mock object covering all surfaces defined
 * in `browser-apis/types.ts`. Designed for reuse across vitest.setup.ts
 * (Chrome) and the future vitest.setup.firefox.ts (Firefox, T14).
 *
 * Surfaces covered (41+):
 *   runtime (9)  | storage (6)       | tabs (7)    | debugger (5)
 *   scripting (4)| action (1)        | alarms (3)  | devtools (6)
 *
 * Each call creates an isolated set of mock fns so concurrent / sequential
 * test suites don't share mutable state.
 */

import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

export type MockStorageState = {
  loggyPanelSettings?: unknown
}

export type MockTabData = {
  id: number
  url: string
  index: number
  pinned: boolean
  highlighted: boolean
  windowId: number
  frozen: boolean
  incognito: boolean
  selected: boolean
  discarded: boolean
  title: string
  favIconUrl: string
  status: string
  autoDiscardable: boolean
  groupId: number
}

// ---------------------------------------------------------------------------
// Helpers used inside the factory
// ---------------------------------------------------------------------------

/** Universal EventSink stub (addListener/removeListener/hasListener). */
const eventSinkStub = () => ({
  addListener: vi.fn(),
  removeListener: vi.fn(),
  hasListener: vi.fn(() => false),
})

/** Returns a vi.fn that resolves to a constant value. */
const noopAsync = <T>(value: T) => vi.fn(() => Promise.resolve(value))

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface ChromeMockResult {
  /** The complete chrome-shaped mock object, assignable to globalThis.chrome. */
  chrome: Record<string, unknown>

  /** The eval mock (devtools.inspectedWindow.eval). */
  mockEval: ReturnType<typeof vi.fn>
  /** The storage.local.get mock (loggy-settings aware). */
  mockStorageGet: ReturnType<typeof vi.fn>
  /** The storage.local.set mock (loggy-settings aware). */
  mockStorageSet: ReturnType<typeof vi.fn>
  /** The scripting.executeScript mock. */
  mockScriptingExecuteScript: ReturnType<typeof vi.fn>

  /** Default mock tab object used by tabs.query / tabs.get / tabs.create. */
  mockTab: MockTabData

  /** Seed the storage state with loggyPanelSettings (or other keys). */
  seedStorage: (data: MockStorageState) => void
  /** Read a snapshot of the current storage state. */
  getStorage: () => MockStorageState
  /** Reset storage state to empty. */
  resetStorage: () => void
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBaseChromeMock(): ChromeMockResult {
  const mockStorageState: MockStorageState = {}

  function seedStorage(data: MockStorageState) {
    resetStorage()
    if ('loggyPanelSettings' in data) {
      mockStorageState.loggyPanelSettings = data.loggyPanelSettings
    }
  }

  function getStorage(): MockStorageState {
    return { ...mockStorageState }
  }

  function resetStorage() {
    delete mockStorageState.loggyPanelSettings
  }

  // --- Storage mocks (existing behavior preserved) ---

  const mockStorageGet = vi.fn(
    (
      keys: string | string[] | Partial<Record<'loggyPanelSettings', unknown>> | null | undefined,
      callback?: (items: Partial<Record<'loggyPanelSettings', unknown>>) => void,
    ) => {
      const result: Partial<Record<'loggyPanelSettings', unknown>> = {}

      if (keys == null) {
        if ('loggyPanelSettings' in mockStorageState) {
          result.loggyPanelSettings = mockStorageState.loggyPanelSettings
        }
        if (typeof callback === 'function') {
          Promise.resolve().then(() => callback(result))
        }
        return
      }

      if (typeof keys === 'string') {
        if (keys === 'loggyPanelSettings' && 'loggyPanelSettings' in mockStorageState) {
          result.loggyPanelSettings = mockStorageState.loggyPanelSettings
        }
        if (typeof callback === 'function') {
          Promise.resolve().then(() => callback(result))
        }
        return
      }

      if (Array.isArray(keys)) {
        if (keys.includes('loggyPanelSettings') && 'loggyPanelSettings' in mockStorageState) {
          result.loggyPanelSettings = mockStorageState.loggyPanelSettings
        }
        if (typeof callback === 'function') {
          Promise.resolve().then(() => callback(result))
        }
        return
      }

      if ('loggyPanelSettings' in keys) {
        if ('loggyPanelSettings' in mockStorageState) {
          result.loggyPanelSettings = mockStorageState.loggyPanelSettings
        } else {
          result.loggyPanelSettings = keys.loggyPanelSettings
        }
      }

      if (typeof callback === 'function') {
        Promise.resolve().then(() => callback(result))
        return
      }
      return Promise.resolve(result)
    },
  )

  const mockStorageSet = vi.fn(
    (items: Partial<Record<'loggyPanelSettings', unknown>>, callback?: () => void) => {
      if ('loggyPanelSettings' in items) {
        mockStorageState.loggyPanelSettings = items.loggyPanelSettings
      }
      if (callback) {
        callback()
      }
    },
  )

  // --- Eval mock (devtools.inspectedWindow.eval) ---

  const mockEval = vi.fn(
    (_script: string, callback: (result?: unknown, isException?: boolean) => void) => {
      if (callback) {
        callback(undefined, false)
      }
    },
  )

  // --- Scripting mock ---

  const mockScriptingExecuteScript = vi.fn(() => Promise.resolve([]))

  // --- Mock tab ---

  const mockTab: MockTabData = {
    id: 1,
    url: 'http://localhost:3000',
    index: 0,
    pinned: false,
    highlighted: true,
    windowId: 1,
    frozen: false,
    incognito: false,
    selected: true,
    discarded: false,
    title: 'Test Page',
    favIconUrl: '',
    status: 'complete',
    autoDiscardable: false,
    groupId: 1,
  }

  // --- Build the chrome-shaped object ---

  const chrome: Record<string, unknown> = {
    runtime: {
      sendMessage: vi.fn(
        (_message: unknown, callback?: (response: unknown) => void) => {
          if (callback) {
            callback({})
            return
          }
          return Promise.resolve({})
        },
      ),
      // Surface explicitly for chrome.ts and tests that check lastError
      lastError: undefined,
      getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
      connect: vi.fn(() => ({
        name: '',
        postMessage: vi.fn(),
        disconnect: vi.fn(),
        onDisconnect: eventSinkStub(),
        onMessage: eventSinkStub(),
      })),
      onMessage: eventSinkStub(),
      onConnect: eventSinkStub(),
      onInstalled: eventSinkStub(),
      onStartup: eventSinkStub(),
      getPlatformInfo: noopAsync({ os: 'mac', arch: 'arm', nacl_arch: 'arm' }),
    },
    storage: {
      local: {
        get: mockStorageGet,
        set: mockStorageSet,
      },
      session: {
        get: noopAsync({}),
        set: noopAsync(undefined),
        remove: noopAsync(undefined),
      },
      onChanged: eventSinkStub(),
    },
    tabs: {
      query: vi.fn((_query: object, callback?: (tabs: MockTabData[]) => void) => {
        const tabs: MockTabData[] = [mockTab]
        if (callback) {
          callback(tabs)
          return
        }
        return Promise.resolve(tabs)
      }),
      get: vi.fn((tabId: number) => Promise.resolve({ ...mockTab, id: tabId })),
      create: vi.fn(() => Promise.resolve(mockTab)),
      sendMessage: vi.fn(
        (_tabId: number, _message: unknown, callback?: (response: unknown) => void) => {
          if (callback) {
            callback({})
            return
          }
          return Promise.resolve({})
        },
      ),
      onRemoved: eventSinkStub(),
      onActivated: eventSinkStub(),
      onUpdated: eventSinkStub(),
    },
    debugger: {
      attach: noopAsync(undefined),
      detach: noopAsync(undefined),
      sendCommand: noopAsync({}),
      onEvent: eventSinkStub(),
      onDetach: eventSinkStub(),
    },
    scripting: {
      executeScript: mockScriptingExecuteScript,
      registerContentScripts: noopAsync(undefined),
      unregisterContentScripts: noopAsync(undefined),
      getRegisteredContentScripts: noopAsync([]),
    },
    action: {
      setIcon: noopAsync(undefined),
    },
    alarms: {
      create: noopAsync(undefined),
      clear: noopAsync(false),
      onAlarm: eventSinkStub(),
    },
    devtools: {
      inspectedWindow: {
        eval: mockEval,
        tabId: 1,
      },
      network: {
        getHAR: vi.fn(() => Promise.resolve({ entries: [] })),
        onRequestFinished: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        onNavigated: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      panels: {
        create: vi.fn(
          (
            _title: string,
            _iconPath: string,
            _pagePath: string,
            callback?: (panel: unknown) => void,
          ) => {
            if (callback) callback({})
          },
        ),
      },
    },
  }

  return {
    chrome,
    mockEval,
    mockStorageGet,
    mockStorageSet,
    mockScriptingExecuteScript,
    mockTab,
    seedStorage,
    getStorage,
    resetStorage,
  }
}
