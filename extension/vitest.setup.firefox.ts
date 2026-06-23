/**
 * Vitest setup for Firefox extension API mocks
 *
 * Mirrors vitest.setup.ts (Chrome) but stubs __BROWSER__ = 'firefox' and
 * assigns the mock to BOTH globalThis.browser AND globalThis.chrome.
 *
 * Firefox uses `chrome.*` in most contexts via the built-in compat shim and
 * `browser.*` in DevTools panel context (moz-extension:// origin), so both
 * globals must resolve to the same mock object for test harness compatibility.
 */

import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'
import { createBaseChromeMock } from './vitest/mocks/base-chrome-mock'

vi.stubGlobal('__BROWSER__', 'firefox')
vi.stubGlobal('__BUILD_KEY__', 'test')
vi.stubGlobal('__DEBUG__', false)

// Create isolated base mock with full extension API surface coverage
const {
  chrome: baseChrome,
  mockEval,
  mockScriptingExecuteScript,
  seedStorage,
  getStorage,
  resetStorage,
} = createBaseChromeMock()

// Assign the mock to both globals: chrome.* (compat shim) and browser.* (native
// Firefox WebExtensions API). firefox.ts references both at runtime.
;(globalThis as Record<string, unknown>).browser = globalThis.chrome = baseChrome

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

// Re-export storage helpers from the base mock
export { seedStorage, getStorage, resetStorage }

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
