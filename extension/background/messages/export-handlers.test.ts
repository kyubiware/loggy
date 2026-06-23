/**
 * Tests for the executeScript fallback in handleGetTabExportData.
 *
 * Verifies that the export-data handler:
 * 1. Returns storage data when the session storage has entries for the tab
 *    (no contamination from MAIN-world arrays).
 * 2. Falls back to MAIN-world executeScript when storage is empty
 *    (Firefox SW cold-start case).
 * 3. Merges executeScript data with storage data using getEntryKey dedup
 *    when both sources have data.
 * 4. Returns storage data when executeScript fails (tab closed, no
 *    content script, permissions error).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mockScriptingExecute } from '../../vitest.setup'
import type { StoredCapturedEntry } from '../entry-storage'

// --- Mock the heavy export pipeline so the test focuses on the merge/fallback ---

vi.mock('../../shared/export', () => ({
  buildExportMarkdown: vi.fn(async () => 'mock-markdown'),
}))

vi.mock('../../utils/filtered-data', () => ({
  getFilteredPanelData: vi.fn((state: { consoleLogs: unknown[]; networkEntries: unknown[] }) => ({
    consoleLogs: state.consoleLogs,
    networkEntries: state.networkEntries,
    routeOptions: [],
  })),
}))

vi.mock('../../utils/token-estimate', () => ({
  estimateTokenCount: vi.fn(() => 42),
}))

// --- Partial mock of entry-storage: real getEntryKey, real converters, mocked readStoredEntries ---

vi.mock('../entry-storage', async () => {
  const actual = await vi.importActual<typeof import('../entry-storage')>('../entry-storage')
  return {
    ...actual,
    readStoredEntries: vi.fn(),
  }
})

// Import AFTER vi.mock so the handler picks up the mocked module
const { handleGetTabExportData } = await import('./export-handlers')
const { readStoredEntries } = await import('../entry-storage')
// getEntryKey/toConsoleMessage/toHAREntry used by handler come from the partial mock's
// `...actual` spread, so they retain the real implementations.

const mockReadStoredEntries = vi.mocked(readStoredEntries)
// `mockScriptingExecute` is typed as the function (return `Promise<never[]>`)
// because vitest.setup.ts initializes it with `vi.fn(() => Promise.resolve([]))`.
// Re-cast to a generic Mock so we can pass typed return values.
const mockScripting = mockScriptingExecute as unknown as ReturnType<typeof vi.fn>

// The vitest.setup.ts storage.local.get mock returns `undefined` (sync) for
// string keys when no callback is provided. The abstraction's Promise
// overload always awaits regardless, so the handler hits
// `undefined[KEY]` and throws. Override the implementation to return
// `Promise.resolve({})` (or call the callback) — the same contract
// chrome.ts's storage wrapper relies on.
const chromeStorageLocalGet = globalThis.chrome.storage.local.get as ReturnType<typeof vi.fn>
const stubStorageGet = () => {
  chromeStorageLocalGet.mockImplementation(
    (_keys: unknown, callback?: (items: Record<string, unknown>) => void) => {
      const items: Record<string, unknown> = {}
      if (typeof callback === 'function') {
        Promise.resolve().then(() => callback(items))
        return
      }
      return Promise.resolve(items)
    },
  )
}

// --- Tests ---

describe('handleGetTabExportData executeScript fallback', () => {
  const TAB_ID = 500

  beforeEach(() => {
    mockReadStoredEntries.mockReset()
    mockScripting.mockReset()
    stubStorageGet()
    // Default: storage has data
    mockReadStoredEntries.mockResolvedValue([])
    // Default: executeScript returns empty MAIN-world data
    mockScripting.mockResolvedValue([{ result: { consoleLogs: [], networkLogs: [] } }])
  })

  it('returns storage data when storage has entries (executeScript data overlapping with storage is deduped)', async () => {
    const storedEntry: StoredCapturedEntry = {
      kind: 'console',
      entry: { timestamp: '2024-01-01T00:00:00.000Z', level: 'log', message: 'from-storage' },
    }
    mockReadStoredEntries.mockResolvedValue([storedEntry])

    // ExecuteScript returns the SAME entry (same key per getEntryKey). The
    // merge should dedup and keep storage's version — logCount = 1.
    mockScripting.mockResolvedValue([{
      result: {
        consoleLogs: [
          { timestamp: '2024-01-01T00:00:00.000Z', level: 'log', message: 'from-storage' },
        ],
        networkLogs: [],
      },
    }])

    const result = await handleGetTabExportData(TAB_ID)

    expect(result.hasData).toBe(true)
    expect(result.logCount).toBe(1)
  })

  it('falls back to executeScript when storage is empty', async () => {
    mockReadStoredEntries.mockResolvedValue([])

    mockScripting.mockResolvedValue([{
      result: {
        consoleLogs: [
          { timestamp: '2024-01-01T00:00:00.000Z', level: 'warn', message: 'main-world-only' },
        ],
        networkLogs: [
          {
            timestamp: '2024-01-01T00:00:00.000Z',
            url: 'https://example.test/api',
            method: 'GET',
            status: 200,
          },
        ],
      },
    }])

    const result = await handleGetTabExportData(TAB_ID)

    expect(mockScripting).toHaveBeenCalledTimes(1)
    expect(result.hasData).toBe(true)
    // 1 console + 1 network = 2 logs
    expect(result.logCount).toBe(2)
  })

  it('merges storage + executeScript data with getEntryKey dedup', async () => {
    const sharedEntry: StoredCapturedEntry = {
      kind: 'console',
      entry: { timestamp: '2024-01-01T00:00:00.000Z', level: 'log', message: 'shared' },
    }
    const storageOnly: StoredCapturedEntry = {
      kind: 'console',
      entry: { timestamp: '2024-01-01T00:00:01.000Z', level: 'log', message: 'storage-only' },
    }
    mockReadStoredEntries.mockResolvedValue([sharedEntry, storageOnly])

    // ExecuteScript returns the shared entry (same timestamp/level/message) plus a
    // unique MAIN-world entry. Dedup must keep storage's version and append the
    // unique one — total 3 unique entries.
    mockScripting.mockResolvedValue([{
      result: {
        consoleLogs: [
          { timestamp: '2024-01-01T00:00:00.000Z', level: 'log', message: 'shared' },
          { timestamp: '2024-01-01T00:00:02.000Z', level: 'info', message: 'main-world-only' },
        ],
        networkLogs: [],
      },
    }])

    const result = await handleGetTabExportData(TAB_ID)

    // 3 unique entries (shared counted once, storage-only, main-world-only)
    expect(result.logCount).toBe(3)
  })

  it('returns storage data when executeScript throws', async () => {
    const storedEntry: StoredCapturedEntry = {
      kind: 'console',
      entry: { timestamp: '2024-01-01T00:00:00.000Z', level: 'error', message: 'kept' },
    }
    mockReadStoredEntries.mockResolvedValue([storedEntry])

    // Tab closed / no content script / permissions error — executeScript rejects.
    mockScripting.mockRejectedValue(new Error('No tab with id: 500'))

    const result = await handleGetTabExportData(TAB_ID)

    expect(result.hasData).toBe(true)
    expect(result.logCount).toBe(1)
  })

  it('returns empty result when both storage and executeScript are empty', async () => {
    mockReadStoredEntries.mockResolvedValue([])
    mockScripting.mockResolvedValue([{ result: { consoleLogs: [], networkLogs: [] } }])

    const result = await handleGetTabExportData(TAB_ID)

    expect(result.hasData).toBe(false)
    expect(result.logCount).toBe(0)
  })
})
