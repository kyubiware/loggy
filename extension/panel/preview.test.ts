/**
 * Tests for panel/preview.ts
 * Preview/export parity tests ensuring consistent behavior between preview and export
 */

import { describe, expect, it } from 'vitest'
import type { FilteredPanelData } from './filtered-data'
import { buildPreviewText, buildStatsText } from './preview'

describe('buildPreviewText - Preview/Export Parity', () => {
  describe('Consolidation parity with export', () => {
    it('should consolidate repeated logs same way as export', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'log',
            message: 'Repeated message',
          },
          {
            timestamp: '2024-01-15T10:30:01Z',
            level: 'log',
            message: 'Repeated message',
          },
          {
            timestamp: '2024-01-15T10:30:02Z',
            level: 'log',
            message: 'Repeated message',
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      // Should show consolidated count
      expect(preview).toContain('(3x)')
      expect(preview).toContain('(3x) [log]')
    })

    it('should compute timestamp range same way as export', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:05Z',
            level: 'log',
            message: 'Repeated message',
          },
          {
            timestamp: '2024-01-15T10:30:01Z',
            level: 'log',
            message: 'Repeated message',
          },
          {
            timestamp: '2024-01-15T10:30:03Z',
            level: 'log',
            message: 'Repeated message',
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      // Should show time range from earliest to latest
      expect(preview).toContain('2024-01-15T10:30:01Z -> 2024-01-15T10:30:05Z')
    })

    it('should not consolidate different messages', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: 'TypeError: Cannot read properties',
          },
          {
            timestamp: '2024-01-15T10:30:01Z',
            level: 'error',
            message: 'ReferenceError: variable not defined',
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      // Both messages should appear separately without '1x'
      expect(preview).not.toContain('(1x)')
      expect(preview).toContain('TypeError: Cannot read properties')
      expect(preview).toContain('ReferenceError: variable not defined')
    })
  })

  describe('Failure signal parity with export', () => {
    it('should identify errors as failure signals same way as export', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: 'TypeError: Cannot read properties',
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      expect(preview).toContain('=== Debug Signals ===')
      expect(preview).toContain('Errors: 1')
      expect(preview).toContain('[error]')
      expect(preview).toContain('Failure-like events: 1')
    })

    it('should identify failure-like warnings same way as export', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'warn',
            message: 'Request failed with status 500',
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      expect(preview).toContain('=== Debug Signals ===')
      expect(preview).toContain('Warnings: 1')
      expect(preview).toContain('[warn]')
      expect(preview).toContain('Failure-like events: 1')
    })

    it('should ignore benign warnings in failure signals same way as export', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'warn',
            message: 'Smooth scroll may be less precise',
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      expect(preview).toContain('=== Debug Signals ===')
      expect(preview).toContain('Warnings: 1')
      expect(preview).toContain('Failure-like events: 0')
    })
  })

  describe('Ranking parity with export', () => {
    it('should rank errors before warnings same way as export', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:01Z',
            level: 'warn',
            message: 'Warning message',
          },
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: 'Error message',
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      // Error should appear before warning
      const errorPos = preview.indexOf('[error]')
      const warnPos = preview.indexOf('[warn]')
      expect(errorPos).toBeGreaterThanOrEqual(0)
      expect(warnPos).toBeGreaterThanOrEqual(0)
      expect(errorPos).toBeLessThan(warnPos)
    })

    it('should rank failure-like warnings before benign warnings', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'warn',
            message: 'Smooth scroll may be less precise',
          },
          {
            timestamp: '2024-01-15T10:30:01Z',
            level: 'warn',
            message: 'Request failed with status 500',
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      // Failure-like warning should appear first
      const benignPos = preview.indexOf('Smooth scroll may be less precise')
      const failurePos = preview.indexOf('Request failed with status 500')
      expect(benignPos).toBeGreaterThanOrEqual(0)
      expect(failurePos).toBeGreaterThanOrEqual(0)
      expect(failurePos).toBeLessThan(benignPos)
    })

    it('should rank repeated failures by count descending', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: 'First error',
          },
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: 'First error',
          },
          {
            timestamp: '2024-01-15T10:30:01Z',
            level: 'error',
            message: 'Second error',
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      // First error (2x) should appear before second error (1x)
      const firstPos = preview.indexOf('First error')
      const secondPos = preview.indexOf('Second error')
      expect(firstPos).toBeGreaterThanOrEqual(0)
      expect(secondPos).toBeGreaterThanOrEqual(0)
      expect(firstPos).toBeLessThan(secondPos)
    })
  })

  describe('Truncation parity with export', () => {
    it('should truncate long messages to 220 chars in preview', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'log',
            message: 'A'.repeat(300),
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      expect(preview).toContain('... [truncated]')
      expect(preview).not.toContain('A'.repeat(300))
    })

    it('should not truncate messages at 220 chars', () => {
      const data: FilteredPanelData = {
        consoleLogs: [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'log',
            message: 'A'.repeat(200),
          },
        ],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      expect(preview).not.toContain('... [truncated]')
    })
  })

  describe('Network entry display', () => {
    it('should display network entries with method, status, and URL', () => {
      const data: FilteredPanelData = {
        consoleLogs: [],
        networkEntries: [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'https://api.example.com/data', method: 'GET' },
            response: { status: 200, statusText: 'OK' },
            time: 100,
          },
        ],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      expect(preview).toContain('=== Network Entries ===')
      expect(preview).toContain('[GET] 200 https://api.example.com/data')
    })

    it('should handle missing request/response fields gracefully', () => {
      const data: FilteredPanelData = {
        consoleLogs: [],
        networkEntries: [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'N/A', method: 'N/A' },
            response: { status: 200, statusText: 'OK' },
          },
        ],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      expect(preview).toContain('[N/A] 200 N/A')
    })
  })

  describe('Empty state handling', () => {
    it('should show helpful message when no data matches filters', () => {
      const data: FilteredPanelData = {
        consoleLogs: [],
        networkEntries: [],
        routeOptions: [],
      }

      const preview = buildPreviewText(data)

      expect(preview).toContain('No console logs or network entries match the current filters')
    })
  })
})

describe('buildStatsText', () => {
  it('should show total and unique console log counts', () => {
    const data: FilteredPanelData = {
      consoleLogs: [
        { timestamp: '2024-01-15T10:30:00Z', level: 'log', message: 'Message 1' },
        { timestamp: '2024-01-15T10:30:01Z', level: 'log', message: 'Message 1' },
        { timestamp: '2024-01-15T10:30:02Z', level: 'log', message: 'Message 2' },
      ],
      networkEntries: [],
      routeOptions: [],
    }

    const stats = buildStatsText(data)

    expect(stats).toBe('3 console logs (2 unique), 0 network entries')
  })

  it('should show network entry count', () => {
    const data: FilteredPanelData = {
      consoleLogs: [],
      networkEntries: [
        {
          startedDateTime: '2024-01-15T10:30:00Z',
          request: { url: 'https://api.example.com/data', method: 'GET' },
          response: { status: 200, statusText: 'OK' },
          time: 100,
        },
      ],
      routeOptions: [],
    }

    const stats = buildStatsText(data)

    expect(stats).toBe('0 console logs (0 unique), 1 network entries')
  })

  it('should count unique logs by level and message', () => {
    const data: FilteredPanelData = {
      consoleLogs: [
        { timestamp: '2024-01-15T10:30:00Z', level: 'error', message: 'Error' },
        { timestamp: '2024-01-15T10:30:01Z', level: 'error', message: 'Error' },
        { timestamp: '2024-01-15T10:30:02Z', level: 'warn', message: 'Error' },
        { timestamp: '2024-01-15T10:30:03Z', level: 'error', message: 'Error' },
      ],
      networkEntries: [],
      routeOptions: [],
    }

    const stats = buildStatsText(data)

    expect(stats).toBe('4 console logs (2 unique), 0 network entries')
  })
})
