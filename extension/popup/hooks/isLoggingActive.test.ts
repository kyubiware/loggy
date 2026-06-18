// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import type { StatusResponse } from '../../types/messages'
import { computeIsLoggingActive } from './isLoggingActive'

/**
 * Tests for the isLoggingActive computation logic.
 *
 * The production logic lives in `./isLoggingActive.ts` and is consumed by
 * `usePopupActions.ts`. Tests exercise the real production function.
 *
 * Semantics:
 * - `devtools` → active (the DevTools panel is capturing directly)
 * - `debugger` → active (Chrome debugger attached)
 * - `content-script` on Firefox → active (Firefox's primary capture mode)
 * - `content-script` on Chrome → INACTIVE (paused — debugger detached,
 *   per the toggle-debugger fallback in capture-control.ts:45-48)
 * - `inactive` → inactive
 * - null status → inactive
 */

describe('isLoggingActive computation', () => {
  describe('devtools mode (panel open)', () => {
    it('is true when mode is devtools on Chrome (panel is capturing)', () => {
      const status: StatusResponse = {
        mode: 'devtools',
        connected: true,
        tabId: 1,
        logCount: 0,
      }
      expect(computeIsLoggingActive(status, false)).toBe(true)
    })

    it('is true when mode is devtools on Firefox', () => {
      const status: StatusResponse = {
        mode: 'devtools',
        connected: true,
        tabId: 1,
        logCount: 0,
      }
      expect(computeIsLoggingActive(status, true)).toBe(true)
    })
  })

  describe('debugger mode (Chrome active capture)', () => {
    it('is true when mode is debugger', () => {
      const status: StatusResponse = {
        mode: 'debugger',
        connected: true,
        tabId: 1,
        logCount: 0,
      }
      expect(computeIsLoggingActive(status, false)).toBe(true)
    })
  })

  describe('content-script mode (browser-dependent)', () => {
    it('is false when mode is content-script on Chrome (paused — debugger detached)', () => {
      // After toggling the debugger off, mode falls back to content-script.
      // The popup should show the Play icon so the user can re-attach the debugger.
      const status: StatusResponse = {
        mode: 'content-script',
        connected: true,
        tabId: 1,
        logCount: 5,
      }
      expect(computeIsLoggingActive(status, false)).toBe(false)
    })

    it('is true when mode is content-script on Firefox (primary capture mode)', () => {
      // Firefox lacks chrome.debugger, so content-script IS the active mode
      // after the user clicks Start Logging.
      const status: StatusResponse = {
        mode: 'content-script',
        connected: true,
        tabId: 1,
        logCount: 5,
      }
      expect(computeIsLoggingActive(status, true)).toBe(true)
    })
  })

  describe('inactive / null states', () => {
    it('is false when mode is inactive (consent view / stopped)', () => {
      const status: StatusResponse = {
        mode: 'inactive',
        connected: false,
        tabId: 1,
        logCount: 0,
      }
      expect(computeIsLoggingActive(status, false)).toBe(false)
    })

    it('is false when status is null', () => {
      expect(computeIsLoggingActive(null, false)).toBe(false)
    })

    it('is false when status is undefined', () => {
      // Signature accepts undefined (matches React useState<StatusResponse | null | undefined>),
      // and optional chaining handles it identically to null.
      expect(computeIsLoggingActive(undefined, false)).toBe(false)
    })

    it('is false when status is null on Firefox', () => {
      expect(computeIsLoggingActive(null, true)).toBe(false)
    })
  })
})
