/**
 * Vitest setup for extension API mocks and testing-library matchers
 */

import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

vi.stubGlobal('__BROWSER__', 'chrome')

type MockStorageState = {
  loggyPanelSettings?: unknown
}

const mockStorageState: MockStorageState = {}

export function seedStorage(data: MockStorageState) {
  resetStorage()
  if ('loggyPanelSettings' in data) {
    mockStorageState.loggyPanelSettings = data.loggyPanelSettings
  }
}

export function getStorage(): MockStorageState {
  return { ...mockStorageState }
}

export function resetStorage() {
  delete mockStorageState.loggyPanelSettings
}

const mockStorageGet = vi.fn(
  (
    keys: string | string[] | Partial<Record<'loggyPanelSettings', unknown>> | null | undefined,
    callback?: (items: Partial<Record<'loggyPanelSettings', unknown>>) => void
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
    }
  }
)

const mockStorageSet = vi.fn(
  (items: Partial<Record<'loggyPanelSettings', unknown>>, callback?: () => void) => {
    if ('loggyPanelSettings' in items) {
      mockStorageState.loggyPanelSettings = items.loggyPanelSettings
    }
    if (callback) {
      callback()
    }
  }
)

// Mock extension devtools inspectedWindow
const mockEval = vi.fn(
  (_script: string, callback: (result?: unknown, isException?: boolean) => void) => {
    // Default implementation: call callback immediately with undefined result and no exception
    if (callback) {
      callback(undefined, false)
    }
  }
)

const mockScriptingExecuteScript = vi.fn(() => Promise.resolve([]))

const mockTab = {
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

type MockTab = typeof mockTab

globalThis.chrome = {
  devtools: {
    inspectedWindow: {
      eval: mockEval,
      tab: mockTab,
    },
    network: {
      getHAR: vi.fn((callback: (harLog: { entries: unknown[] }) => void) => {
        // Default implementation: call callback immediately with empty entries
        if (callback) {
          callback({ entries: [] })
        }
      }),
      onRequestFinished: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      onNavigated: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  },
  tabs: {
    query: vi.fn((_query: object, callback?: (tabs: MockTab[]) => void) => {
      const tabs: MockTab[] = [mockTab]
      if (callback) {
        callback(tabs)
      }
      return Promise.resolve(tabs)
    }),
  },
  storage: {
    local: {
      get: mockStorageGet,
      set: mockStorageSet,
    },
  },
  scripting: {
    executeScript: mockScriptingExecuteScript,
  } as unknown as typeof chrome.scripting,
} as unknown as typeof chrome

// Export mock functions for use in tests
export const mockChromeEval = mockEval
const extensionApi = globalThis.chrome as typeof chrome
export const mockChromeGetHAR = extensionApi.devtools.network.getHAR as ReturnType<typeof vi.fn>
export const mockChromeOnRequestFinished = extensionApi.devtools.network.onRequestFinished
  .addListener as ReturnType<typeof vi.fn>
export const mockChromeOnRequestFinishedRemove = extensionApi.devtools.network.onRequestFinished
  .removeListener as ReturnType<typeof vi.fn>
export const mockChromeTabsQuery = extensionApi.tabs.query as ReturnType<typeof vi.fn>
export const mockChromeStorageGet = extensionApi.storage.local.get as ReturnType<typeof vi.fn>
export const mockChromeStorageSet = extensionApi.storage.local.set as ReturnType<typeof vi.fn>
export const mockScriptingExecute = mockScriptingExecuteScript

// Helper functions for deterministic capture testing
export function mockBootstrapInstall(logs: unknown[] = []) {
  mockEval.mockImplementationOnce((_script: string, callback) => {
    callback(logs, false)
  })
}

export function mockLogRetrieval(logs: unknown[]) {
  mockEval.mockImplementationOnce((_script: string, callback) => {
    callback(logs, false)
  })
}

export function mockEvalException() {
  mockEval.mockImplementationOnce((_script: string, callback) => {
    callback(undefined, true)
  })
}

// Reset all mocks before each test
beforeEach(() => {
  mockEval.mockClear()
  mockChromeGetHAR.mockClear()
  mockChromeOnRequestFinished.mockClear()
  mockChromeOnRequestFinishedRemove.mockClear()
  mockChromeTabsQuery.mockClear()
  mockChromeStorageGet.mockClear()
  mockChromeStorageSet.mockClear()
  mockScriptingExecuteScript.mockClear()
  resetStorage()
})
