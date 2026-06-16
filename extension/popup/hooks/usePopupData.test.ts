// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TabExportDataResponse } from '../../types/messages'
import { usePopupData } from './usePopupData'

/**
 * Mock useFirefoxDirectCapture so it doesn't set up its `setInterval` poller
 * (which would cause vi.runAllTimers() to loop forever). We're testing the
 * Chrome code path here, so the Firefox hook's internals are irrelevant.
 */
vi.mock('./useFirefoxDirectCapture', () => ({
  useFirefoxDirectCapture: () => ({
    tokenCount: 0,
    markdown: '',
    hasData: false,
    logCount: 0,
    routeOptions: [],
    loading: false,
    refresh: vi.fn(),
  }),
}))

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
  debugger?: unknown
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

    // Ensure the Chrome code path is taken (not Firefox). The global chrome
    // mock in vitest.setup.ts omits `chrome.debugger`, which would otherwise
    // make `typeof chrome.debugger === 'undefined'` true → isFirefox=true.
    mock.debugger = {}

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
    delete mock.debugger
    delete mock.runtime
  })

  it('does NOT flip loading back to true on subsequent refreshes', () => {
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
    act(() => {
      vi.runAllTimers()
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
    act(() => {
      vi.runAllTimers()
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
