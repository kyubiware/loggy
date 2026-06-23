// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabExportDataResponse } from '../../types/messages'
import { createDefaultSettings, type PersistedLoggySettings } from '../../types/state'
import { usePopupData } from './usePopupData'

/**
 * Regression tests for the scroll-position preservation fix.
 *
 * Background: `refresh()` previously called `setLoading(true)` on every
 * invocation, including refreshes triggered by debounced `selectedRoutes`
 * changes (route toggles, Select All, Deselect All). That flipped `isLoading`
 * in `Popup.tsx`, which unmounted the entire content tree (returning the
 * `<div>Loading...</div>` placeholder) and destroyed scroll position when the
 * tree re-mounted moments later.
 *
 * The fix removed `setLoading(true)` from `refresh()` — `useState(true)` still
 * gates the initial load, but subsequent refreshes keep the content mounted.
 */

// Permissive chrome mock surface — we only need a few fields, and the real
// chrome type doesn't mark them optional, so we cast through unknown.
type ChromeMock = {
  runtime?: {
    sendMessage: (
      message: unknown,
      callback?: (response: unknown) => void,
    ) => void
    lastError: { message: string } | null
  }
}

function chromeMock(): ChromeMock {
  return globalThis.chrome as unknown as ChromeMock
}

describe('usePopupData — scroll preservation', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    const mock = chromeMock()

    mock.runtime = {
      lastError: null,
      sendMessage: vi.fn(
        (_message: unknown, callback?: (response: unknown) => void) => {
          // Mirror real chrome.runtime.sendMessage timing: the callback
          // fires on a later tick (IPC round-trip to the background worker).
          // Synchronous callbacks would let React batch setLoading(true)
          // + setLoading(false) together, masking the regression.
          const response: TabExportDataResponse = {
            tokenCount: 100,
            markdown: '# export',
            hasData: true,
            logCount: 1,
            routeOptions: ['/api/users', '/api/posts'],
          }
          setTimeout(() => callback?.(response), 0)
        },
      ),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    const mock = chromeMock()
    delete mock.runtime
  })

  it('does NOT flip loading back to true on subsequent refreshes', async () => {
    // Track every loading value the hook exposes across renders. The bug
    // signature is: true → false (initial load) → TRUE (refresh) → false.
    // After the fix the trace should be: true → false → false → false.
    const loadingTrace: boolean[] = []
    const { result } = renderHook(() => {
      const hook = usePopupData(1, undefined)
      loadingTrace.push(hook.loading)
      return hook
    })

    // Drain the mount effect + the setTimeout callback inside refresh.
    // This flips loading from its initial `true` to `false`.
    // Uses vi.advanceTimersByTimeAsync(100) to flush all setTimeout(0)
    // chains (including the browser-apis Promise microtasks, per T11
    // learning) WITHOUT firing the 2s setInterval that the mount effect
    // sets up (D2: popup polling on both browsers). vi.runAllTimersAsync
    // would loop forever on the interval.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    // Confirm the initial load completed.
    expect(result.current.loading).toBe(false)

    const sendMessage = chromeMock().runtime?.sendMessage as ReturnType<
      typeof vi.fn
    >
    const callsAfterInitialLoad = sendMessage.mock.calls.length

    // Trigger a refresh directly. This mirrors what happens after the
    // selectedRoutes debounce fires (filter typing, route toggles,
    // Select All / Deselect All).
    //
    // Two separate act() blocks are intentional: refresh() calls
    // setLoading(true) synchronously, and the sendMessage setTimeout later
    // calls setLoading(false). Batching them in one act() would let React
    // skip the intermediate render (the bug signature), hiding the
    // regression. Splitting them forces React to commit loading=true before
    // the setTimeout fires.
    act(() => {
      result.current.refresh()
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    // Sanity check: the refresh actually hit the background.
    expect(sendMessage.mock.calls.length).toBeGreaterThan(callsAfterInitialLoad)

    // Critical regression assertion: once loading became false, it must
    // NEVER flip back to true. If it did, the Popup tree would unmount
    // (via the `if (isLoading)` gate in Popup.tsx) and the user's scroll
    // position would be lost.
    const firstFalseIndex = loadingTrace.indexOf(false)
    expect(firstFalseIndex).toBeGreaterThanOrEqual(0)
    const afterFirstFalse = loadingTrace.slice(firstFalseIndex)
    expect(afterFirstFalse.every((value) => value === false)).toBe(true)
  })
})

/**
 * Regression tests for the settings re-fetch.
 *
 * Background: `usePopupData`'s `refresh` callback previously only depended on
 * `[isFirefox, debouncedRoutes, routesFilterEnabled]` — no settings. So
 * changing a markdown-affecting setting (e.g. responseBodyMode smart → full)
 * never triggered a re-fetch, leaving the token count stale.
 *
 * The fix passes a memoized fingerprint of only the export-relevant settings
 * into the `refresh` deps. These tests verify (a) an export-relevant change
 * triggers a re-fetch and (b) a pure-UI change (serverUrl) does NOT, since the
 * server URL field is undebounced and per-keystroke round-trips would be
 * wasteful.
 */
describe('usePopupData — settings re-fetch', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    const mock = chromeMock()

    mock.runtime = {
      lastError: null,
      sendMessage: vi.fn(
        (_message: unknown, callback?: (response: unknown) => void) => {
          const response: TabExportDataResponse = {
            tokenCount: 100,
            markdown: '# export',
            hasData: true,
            logCount: 1,
            routeOptions: ['/api/users'],
          }
          setTimeout(() => callback?.(response), 0)
        },
      ),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    const mock = chromeMock()
    delete mock.runtime
  })

  it('re-fetches when an export-relevant setting changes (responseBodyMode)', async () => {
    const settingsA = createDefaultSettings()
    const settingsB: PersistedLoggySettings = { ...settingsA, responseBodyMode: 'full' }

    const { rerender } = renderHook(
      ({ settings }: { settings: PersistedLoggySettings }) =>
        usePopupData(1, undefined, undefined, settings),
      { initialProps: { settings: settingsA } },
    )

    // Drain initial mount fetch. advanceTimersByTimeAsync(100) processes
    // the setTimeout(0) chain (D13 Promise microtasks) without firing the
    // 2s setInterval (D2 polling) — runAllTimersAsync would loop forever.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    const sendMessage = chromeMock().runtime?.sendMessage as ReturnType<typeof vi.fn>
    const callsAfterInitial = sendMessage.mock.calls.length

    // Change responseBodyMode smart → full. This is the reported bug scenario.
    rerender({ settings: settingsB })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(sendMessage.mock.calls.length).toBeGreaterThan(callsAfterInitial)
  })

  it('does NOT re-fetch when only a pure-UI setting changes (serverUrl)', async () => {
    const settingsA = createDefaultSettings()
    const settingsB: PersistedLoggySettings = {
      ...settingsA,
      serverUrl: 'http://example.test:8743',
    }

    const { rerender } = renderHook(
      ({ settings }: { settings: PersistedLoggySettings }) =>
        usePopupData(1, undefined, undefined, settings),
      { initialProps: { settings: settingsA } },
    )

    // advanceTimersByTimeAsync(100) — see test above for rationale.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    const sendMessage = chromeMock().runtime?.sendMessage as ReturnType<typeof vi.fn>
    const callsAfterInitial = sendMessage.mock.calls.length

    // Typing in the server URL field must not fire a background export fetch.
    rerender({ settings: settingsB })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    expect(sendMessage.mock.calls.length).toBe(callsAfterInitial)
  })
})

/**
 * Tests for the popup polling (D2: 2s polling on both browsers, T17).
 *
 * Verifies:
 * - Synchronous-on-mount refresh fires a sendMessage (D19: covers SW cold-start)
 * - setInterval is set up with 2000ms period
 * - Cleanup on unmount clears the interval (no further refreshes)
 */
describe('usePopupData — polling (D2: 2s on both browsers)', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    const mock = chromeMock()
    mock.runtime = {
      lastError: null,
      sendMessage: vi.fn(
        (_message: unknown, callback?: (response: unknown) => void) => {
          const response: TabExportDataResponse = {
            tokenCount: 0,
            markdown: '',
            hasData: false,
            logCount: 0,
            routeOptions: [],
          }
          setTimeout(() => callback?.(response), 0)
        },
      ),
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    const mock = chromeMock()
    delete mock.runtime
  })

  it('fires a synchronous refresh on mount', async () => {
    const { result } = renderHook(() => usePopupData(1, undefined))

    const sendMessage = chromeMock().runtime?.sendMessage as ReturnType<
      typeof vi.fn
    >

    // Drain the mount refresh's setTimeout(0) chain (D13 Promise microtasks).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })

    // The mount useEffect must have called refresh() at least once.
    expect(sendMessage.mock.calls.length).toBeGreaterThan(0)
    expect(result.current.loading).toBe(false)
  })

  it('polls every 2000ms via setInterval', async () => {
    const { unmount } = renderHook(() => usePopupData(1, undefined))

    const sendMessage = chromeMock().runtime?.sendMessage as ReturnType<
      typeof vi.fn
    >

    // Drain the initial mount refresh.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    const callsAfterMount = sendMessage.mock.calls.length

    // Advance 2s — the interval should fire exactly once.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    const callsAfterFirstInterval = sendMessage.mock.calls.length
    expect(callsAfterFirstInterval).toBeGreaterThan(callsAfterMount)

    // Advance another 2s — second interval fire.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(sendMessage.mock.calls.length).toBeGreaterThan(callsAfterFirstInterval)

    unmount()
  })

  it('clears the interval on unmount (no further refreshes)', async () => {
    const { unmount } = renderHook(() => usePopupData(1, undefined))

    const sendMessage = chromeMock().runtime?.sendMessage as ReturnType<
      typeof vi.fn
    >

    // Drain mount refresh.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    const callsAtUnmount = sendMessage.mock.calls.length

    unmount()

    // Advance 4s post-unmount — no new sendMessage calls (interval was cleared).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })
    expect(sendMessage.mock.calls.length).toBe(callsAtUnmount)
  })
})
