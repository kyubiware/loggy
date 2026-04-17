import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildExportMarkdown, triggerServerExport } from './export'
import { getFilteredPanelData } from './filtered-data'
import { pushToServer } from './server-export'
import { createInitialState } from './state'

vi.mock('./server-export', () => ({
  pushToServer: vi.fn().mockResolvedValue(true),
}))

describe('buildExportMarkdown', () => {
  it('includes LLM guidance when includeAgentContext is enabled', async () => {
    const state = createInitialState()
    state.includeAgentContext = true

    const markdown = await buildExportMarkdown(state)

    expect(markdown).toContain('### LLM Guidance')
  })

  it('omits LLM guidance when includeAgentContext is disabled', async () => {
    const state = createInitialState()
    state.includeAgentContext = false

    const markdown = await buildExportMarkdown(state)

    expect(markdown).not.toContain('### LLM Guidance')
  })

  it('initial state has includeResponseBodies field set to false', () => {
    const state = createInitialState()

    expect(state).toHaveProperty('includeResponseBodies')
    expect(state.includeResponseBodies).toBe(false)
  })

  it('initial state has selectedRoutes field set to empty array', () => {
    const state = createInitialState()

    expect(state).toHaveProperty('selectedRoutes')
    expect(state.selectedRoutes).toEqual([])
  })

  it('can set includeResponseBodies to true on state object', () => {
    const state = createInitialState()
    state.includeResponseBodies = true

    expect(state.includeResponseBodies).toBe(true)
  })

  it('includes response bodies in export when includeResponseBodies is true', async () => {
    const state = createInitialState()
    state.includeResponseBodies = true
    state.networkEntries = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: {
            size: 1024,
            mimeType: 'application/json',
            text: '{"result":"success"}',
          },
        },
        time: 100,
      },
    ]

    const markdown = await buildExportMarkdown(state)

    expect(markdown).toContain('#### Response Content')
    expect(markdown).toContain('```json')
    expect(markdown).toContain('{"result":"success"}')
  })

  it('omits response bodies in export when includeResponseBodies is false', async () => {
    const state = createInitialState()
    state.includeResponseBodies = false
    state.networkEntries = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: {
            size: 1024,
            mimeType: 'application/json',
            text: '{"result":"success"}',
          },
        },
        time: 100,
      },
    ]

    const markdown = await buildExportMarkdown(state)

    expect(markdown).not.toContain('#### Response Content')
    expect(markdown).not.toContain('```json')
    expect(markdown).not.toContain('{"result":"success"}')
  })

  it('respects selected routes via shared filtered data during export', async () => {
    const state = createInitialState()
    state.networkEntries = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://api.example.com/users', method: 'GET', headers: [] },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          content: { size: 10, mimeType: 'application/json' },
        },
        time: 100,
      },
      {
        startedDateTime: '2024-01-15T10:31:00Z',
        request: { url: 'https://api.example.com/orders', method: 'GET', headers: [] },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [],
          content: { size: 10, mimeType: 'application/json' },
        },
        time: 100,
      },
    ]
    state.selectedRoutes = ['/orders']

    const filteredData = getFilteredPanelData(state)
    const markdown = await buildExportMarkdown(state)

    expect(filteredData.routeOptions).toEqual(['/orders', '/users'])
    expect(filteredData.networkEntries).toHaveLength(1)
    expect(filteredData.networkEntries[0]?.request.url).toBe('https://api.example.com/orders')
    expect(markdown).toContain('### GET https://api.example.com/orders')
    expect(markdown).not.toContain('### GET https://api.example.com/users')
  })

  it('prunes stale route selections when network filter removes matching routes', () => {
    const state = createInitialState()
    state.networkEntries = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://api.example.com/users', method: 'GET' },
        response: { status: 200, statusText: 'OK' },
      },
      {
        startedDateTime: '2024-01-15T10:31:00Z',
        request: { url: 'https://api.example.com/orders', method: 'GET' },
        response: { status: 200, statusText: 'OK' },
      },
    ]
    state.selectedRoutes = ['/users', '/orders']

    state.networkFilter = 'orders'

    const filteredData = getFilteredPanelData(state)

    expect(filteredData.routeOptions).toEqual(['/orders'])
    expect(filteredData.networkEntries).toHaveLength(1)
    expect(filteredData.networkEntries[0]?.request.url).toBe('https://api.example.com/orders')
  })

  it('initial state has truncateConsoleLogs field set to true', () => {
    const state = createInitialState()

    expect(state).toHaveProperty('truncateConsoleLogs')
    expect(state.truncateConsoleLogs).toBe(true)
  })

  it('truncates long console messages when truncateConsoleLogs is true (default)', async () => {
    const state = createInitialState()
    state.truncateConsoleLogs = true
    state.consoleLogs = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'error',
        message: 'A'.repeat(600), // Long message that should be truncated
      },
    ]

    const markdown = await buildExportMarkdown(state)

    // Should contain truncation indicator
    expect(markdown).toContain('... [truncated]')
    // Should not contain full message
    expect(markdown).not.toContain('A'.repeat(600))
  })

  it('includes full console messages when truncateConsoleLogs is false', async () => {
    const state = createInitialState()
    state.truncateConsoleLogs = false
    const longMessage = 'A'.repeat(600)
    state.consoleLogs = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'error',
        message: longMessage,
      },
    ]

    const markdown = await buildExportMarkdown(state)

    // Should NOT contain truncation indicator
    expect(markdown).not.toContain('... [truncated]')
    // Should contain full message
    expect(markdown).toContain(longMessage)
  })

  it('preserves other export settings when truncateConsoleLogs is false', async () => {
    const state = createInitialState()
    state.truncateConsoleLogs = false
    state.includeAgentContext = true
    state.includeResponseBodies = true
    state.consoleLogs = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'error',
        message: 'Test error message',
      },
    ]
    state.networkEntries = [
      {
        startedDateTime: '2024-01-15T10:31:00Z',
        request: {
          url: 'https://api.example.com/data',
          method: 'GET',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
        },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'Content-Type', value: 'application/json' }],
          content: {
            size: 1024,
            mimeType: 'application/json',
            text: '{"result":"success"}',
          },
        },
        time: 100,
      },
    ]

    const markdown = await buildExportMarkdown(state)

    // Should include all sections
    expect(markdown).toContain('### LLM Guidance')
    expect(markdown).toContain('### Console Logs')
    expect(markdown).toContain('### Network Requests')
    expect(markdown).toContain('#### Response Content')
    expect(markdown).toContain('Test error message')
    expect(markdown).toContain('{"result":"success"}')
  })

  describe('Token-efficient export contract', () => {
    describe('Canonical failure ranking', () => {
      it('should rank errors before warnings in Debug Signals section', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:01Z',
            level: 'warn',
            message: 'Warning failed with status 500',
          },
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: 'Error message',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        // Error should appear before warning in Debug Signals
        const errorPos = markdown.indexOf('[error]')
        const warnPos = markdown.lastIndexOf('[warn]')
        expect(errorPos).toBeGreaterThanOrEqual(0)
        expect(warnPos).toBeGreaterThanOrEqual(0)
        expect(errorPos).toBeLessThan(warnPos)
      })

      it('should rank failure-like warnings above benign warnings', async () => {
        const state = createInitialState()
        state.consoleLogs = [
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
        ]

        const markdown = await buildExportMarkdown(state)

        // Failure-like warning (500 status) should appear first
        const benignPos = markdown.indexOf('Smooth scroll may be less precise')
        const failurePos = markdown.indexOf('Request failed with status 500')
        expect(benignPos).toBeGreaterThanOrEqual(0)
        expect(failurePos).toBeGreaterThanOrEqual(0)
        expect(failurePos).toBeLessThan(benignPos)
      })

      it('should rank repeated failures by count (descending)', async () => {
        const state = createInitialState()
        state.consoleLogs = [
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
        ]

        const markdown = await buildExportMarkdown(state)

        // First error (2x) should appear before second error (1x)
        const firstPos = markdown.indexOf('First error')
        const secondPos = markdown.indexOf('Second error')
        expect(firstPos).toBeGreaterThanOrEqual(0)
        expect(secondPos).toBeGreaterThanOrEqual(0)
        expect(firstPos).toBeLessThan(secondPos)
      })
    })

    describe('Representative serialization', () => {
      it('should include canonical unhandled rejection messages in export', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: 'Unhandled promise rejection: Error: Request queue stalled',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('Unhandled promise rejection: Error: Request queue stalled')
        expect(markdown).toContain('[error]')
      })

      it('should serialize TypeError with name and message in export', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: "TypeError: Cannot read properties of undefined (reading 'id')",
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain("TypeError: Cannot read properties of undefined (reading 'id')")
        expect(markdown).toContain('[error]')
      })

      it('should serialize circular objects with a [Circular] marker', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'log',
            message: '{name: "root", self: [Circular]}',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('{name: "root", self: [Circular]}')
      })

      it('should serialize arrays with proper JSON format', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'log',
            message: '[1, 2, {nested: "value"}]',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('[1, 2, {nested: "value"}]')
      })

      it('should serialize DOM-like objects with key properties', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'log',
            message: '<div#app.container>',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('<div#app.container>')
      })

      it('should serialize undefined as string "undefined"', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'log',
            message: 'undefined',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('undefined')
      })

      it('should serialize null as string "null"', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'log',
            message: 'null',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('null')
      })

      it('should serialize BigInt/Symbol as semantic strings', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'log',
            message: '9007199254740991n Symbol(test)',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('9007199254740991n Symbol(test)')
      })
    })

    describe('Repeated-event consolidation', () => {
      it('should consolidate identical console logs into single row with count', async () => {
        const state = createInitialState()
        state.consoleLogs = [
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
        ]

        const markdown = await buildExportMarkdown(state)

        // Should show consolidated count
        expect(markdown).toContain('**Console Logs**: 3')
        expect(markdown).toContain('**Unique Console Events**: 1')
        expect(markdown).toContain('**Consolidated Repeats**: 2')
        expect(markdown).toContain('| 3 |')
      })

      it('should compute first and last timestamps for consolidated logs', async () => {
        const state = createInitialState()
        state.consoleLogs = [
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
        ]

        const markdown = await buildExportMarkdown(state)

        // Should show time range from earliest to latest
        expect(markdown).toContain('10:30:01')
        expect(markdown).toContain('10:30:05')
      })

      it('should consolidate repeated errors and include in Debug Signals', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: 'TypeError: Cannot read properties of undefined',
          },
          {
            timestamp: '2024-01-15T10:30:01Z',
            level: 'error',
            message: 'TypeError: Cannot read properties of undefined',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('[error] (2x)')
        expect(markdown).toContain('TypeError: Cannot read properties of undefined')
      })

      it('should not consolidate different error messages', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          {
            timestamp: '2024-01-15T10:30:00Z',
            level: 'error',
            message: 'TypeError: Cannot read properties of undefined',
          },
          {
            timestamp: '2024-01-15T10:30:01Z',
            level: 'error',
            message: 'ReferenceError: variable is not defined',
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('**Unique Console Events**: 2')
        expect(markdown).toContain('TypeError: Cannot read properties of undefined')
        expect(markdown).toContain('ReferenceError: variable is not defined')
      })
    })

    describe('Export metadata', () => {
      it('should include accurate counts for console logs', async () => {
        const state = createInitialState()
        state.consoleLogs = [
          { timestamp: '2024-01-15T10:30:00Z', level: 'error', message: 'Error 1' },
          { timestamp: '2024-01-15T10:30:01Z', level: 'error', message: 'Error 1' },
          { timestamp: '2024-01-15T10:30:02Z', level: 'warn', message: 'Warning 1' },
          { timestamp: '2024-01-15T10:30:03Z', level: 'log', message: 'Log 1' },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('**Console Logs**: 4')
        expect(markdown).toContain('**Unique Console Events**: 3')
        expect(markdown).toContain('**Consolidated Repeats**: 1')
        expect(markdown).toContain('**Errors (raw/consolidated)**: 2/1')
        expect(markdown).toContain('**Warnings (raw/consolidated)**: 1/1')
      })

      it('should include network request count', async () => {
        const state = createInitialState()
        state.networkEntries = [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'https://api.example.com/data', method: 'GET' },
            response: { status: 200, statusText: 'OK' },
            time: 100,
          },
          {
            startedDateTime: '2024-01-15T10:30:01Z',
            request: { url: 'https://api.example.com/data2', method: 'POST' },
            response: { status: 201, statusText: 'Created' },
            time: 150,
          },
        ]

        const markdown = await buildExportMarkdown(state)

        expect(markdown).toContain('**Network Requests**: 2')
      })
    })
  })

  describe('Server export trigger', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('posts to configured server when connected', () => {
      const state = createInitialState()
      state.serverConnected = true
      state.serverUrl = 'https://example.com/export'

      triggerServerExport(state, '# markdown')

      expect(pushToServer).toHaveBeenCalledWith('https://example.com/export', '# markdown')
    })

    it('does not post when server is disconnected', () => {
      const state = createInitialState()
      state.serverConnected = false
      state.serverUrl = 'https://example.com/export'

      triggerServerExport(state, '# markdown')

      expect(pushToServer).not.toHaveBeenCalled()
    })

    it('shows success toast when server export succeeds', async () => {
      const state = createInitialState()
      state.serverConnected = true
      state.serverUrl = 'https://example.com/export'
      const showToast = vi.fn()

      vi.mocked(pushToServer).mockResolvedValueOnce(true)

      triggerServerExport(state, '# markdown', showToast)

      // Wait for promise to resolve
      await vi.waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Exported to server!', 'success')
      })
    })

    it('shows error toast when server export fails', async () => {
      const state = createInitialState()
      state.serverConnected = true
      state.serverUrl = 'https://example.com/export'
      const showToast = vi.fn()

      vi.mocked(pushToServer).mockResolvedValueOnce(false)

      triggerServerExport(state, '# markdown', showToast)

      // Wait for promise to resolve
      await vi.waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Server export failed', 'error')
      })
    })

    it('does not show toast when showToast is not provided', async () => {
      const state = createInitialState()
      state.serverConnected = true
      state.serverUrl = 'https://example.com/export'

      vi.mocked(pushToServer).mockResolvedValueOnce(false)

      // Should not throw even when showToast is undefined
      triggerServerExport(state, '# markdown')

      // Wait a tick to ensure no errors
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
  })
})
