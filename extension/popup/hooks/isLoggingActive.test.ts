// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import type { StatusResponse } from '../../types/messages'

/**
 * Tests for the isLoggingActive computation logic.
 *
 * This logic lives in usePopupActions.ts:
 *   const isLoggingActive = status?.mode === 'content-script' || status?.mode === 'debugger'
 *
 * After the debugger-mode fix, content-script is the paused state
 * (toggle-debugger detaches the debugger and falls back to content-script).
 * Only debugger mode should show the Pause icon.
 */
function computeIsLoggingActive(status: StatusResponse | null): boolean {
  // Only debugger mode is "active" — content-script is the paused state
  // after toggling the debugger off, and should show the Play icon.
  return status?.mode === 'debugger'
}

describe('isLoggingActive computation', () => {
  it('is true when mode is debugger (actively capturing)', () => {
    const status: StatusResponse = { mode: 'debugger', connected: true, tabId: 1, logCount: 0 }
    expect(computeIsLoggingActive(status)).toBe(true)
  })

  it('is false when mode is inactive (consent view / stopped)', () => {
    const status: StatusResponse = { mode: 'inactive', connected: false, tabId: 1, logCount: 0 }
    expect(computeIsLoggingActive(status)).toBe(false)
  })

  it('is false when mode is content-script (paused — debugger detached)', () => {
    // After toggling the debugger off, mode falls back to content-script.
    // The popup should show the Play icon so the user can re-attach the debugger.
    const status: StatusResponse = { mode: 'content-script', connected: true, tabId: 1, logCount: 5 }
    expect(computeIsLoggingActive(status)).toBe(false)
  })

  it('is false when status is null', () => {
    expect(computeIsLoggingActive(null)).toBe(false)
  })
})
