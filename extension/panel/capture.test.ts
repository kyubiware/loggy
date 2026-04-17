/**
 * Tests for panel/capture.ts
 * Serialization semantics and capture contract tests for token-efficient exports
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DevToolsNetworkRequest } from '../browser-apis'
import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'
import {
  mockChromeEval,
  mockChromeGetHAR,
  mockChromeOnRequestFinished,
  mockChromeOnRequestFinishedRemove,
} from '../vitest.setup'
import {
  captureConsoleLogs,
  captureNetworkEntries,
  clearResponseBodies,
  enrichWithResponseBodies,
  startResponseBodyCapture,
  stopResponseBodyCapture,
} from './capture'

type BootstrapConsole = Record<
  'log' | 'warn' | 'error' | 'info' | 'debug',
  (...args: unknown[]) => void
>

type BootstrapOnErrorHandler = (
  message?: unknown,
  filename?: string,
  lineno?: number,
  colno?: number,
  error?: Error
) => boolean | undefined

type BootstrapRejectionEvent = {
  reason: unknown
}

type BootstrapOnUnhandledRejectionHandler = (event: BootstrapRejectionEvent) => unknown

type BootstrapWindow = {
  __loggyConsoleCaptureInstalled?: boolean
  __loggyConsoleLogs?: ConsoleMessage[]
  onerror?: BootstrapOnErrorHandler | null
  onunhandledrejection?: BootstrapOnUnhandledRejectionHandler | null
  postMessage?: (...args: unknown[]) => void
  fetch?: (...args: unknown[]) => unknown
  XMLHttpRequest?: unknown
}

type CircularTestObject = {
  name: string
  self: CircularTestObject | null
}

type ParentTestObject = {
  name: string
  child?: ChildTestObject
}

type ChildTestObject = {
  name: string
  parent: ParentTestObject
}

function mockBootstrapCapture(
  emitLogs: (sandboxConsole: BootstrapConsole, sandboxWindow: BootstrapWindow) => void,
  options?: {
    initialWindow?: Partial<BootstrapWindow>
  }
): void {
  const sandboxWindow: BootstrapWindow = {
    ...options?.initialWindow,
    postMessage: vi.fn(),
  }
  const sandboxConsole: BootstrapConsole = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }

  mockChromeEval.mockImplementation((script: string, callback) => {
    if (script === 'window.__loggyConsoleLogs || []') {
      callback(sandboxWindow.__loggyConsoleLogs || [], false)
      return
    }

    new Function('window', 'console', script)(sandboxWindow, sandboxConsole)
    emitLogs(sandboxConsole, sandboxWindow)
    callback(undefined, false)
  })
}

function mockCapturedLogsResult(
  result: ConsoleMessage[] | null | undefined,
  isException = false
): void {
  mockChromeEval.mockImplementation((script: string, callback) => {
    if (script === 'window.__loggyConsoleLogs || []') {
      callback(result, isException)
      return
    }

    callback(undefined, false)
  })
}

describe('captureConsoleLogs - Serialization Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Error object serialization', () => {
    it('should serialize TypeError with message, name, and bounded stack excerpt', async () => {
      const error = new TypeError("Cannot read properties of undefined (reading 'id')")
      error.stack = [
        "TypeError: Cannot read properties of undefined (reading 'id')",
        '    at fn (file.js:10:5)',
        '    at render (view.js:5:3)',
        '    at main (app.js:1:1)',
        '    at ignored (other.js:2:1)',
      ].join('\n')

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.error(error)
      })

      const logs = await captureConsoleLogs()

      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        level: 'error',
      })
      expect(logs[0].message).toBe(
        "TypeError: Cannot read properties of undefined (reading 'id') at fn (file.js:10:5) at render (view.js:5:3) at main (app.js:1:1)"
      )
    })

    it('should serialize Error objects with stack traces when available', async () => {
      const error = new Error('Test error')
      error.stack = 'Error: Test error\n    at test.js:10:5'

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.error(error)
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('Error: Test error at test.js:10:5')
    })

    it('should serialize ReferenceError with name property', async () => {
      const error = new ReferenceError('variable is not defined')
      error.stack = 'ReferenceError: variable is not defined\n    at init (app.js:8:2)'
      const expectedMessage = 'ReferenceError: variable is not defined'

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.error(error)
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe(`${expectedMessage} at init (app.js:8:2)`)
    })
  })

  describe('Circular object serialization', () => {
    it('should handle circular references without throwing', async () => {
      const circular: CircularTestObject = { name: 'root', self: null }
      circular.self = circular

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log(circular)
      })

      const logs = await captureConsoleLogs()

      expect(logs).toHaveLength(1)
      expect(logs[0].message).toBe('{name: "root", self: [Circular]}')
    })

    it('should serialize nested circular objects gracefully', async () => {
      const parent: ParentTestObject = { name: 'parent' }
      const child: ChildTestObject = { name: 'child', parent }
      parent.child = child

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log(parent)
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('{name: "parent", child: {name: "child", parent: [Circular]}}')
    })
  })

  describe('Array serialization', () => {
    it('should serialize simple arrays', async () => {
      const array = [1, 2, 3]

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log(array)
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('[1, 2, 3]')
    })

    it('should serialize arrays with nested objects', async () => {
      const array = [1, 2, { nested: 'value' }]

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log(array)
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('[1, 2, {nested: "value"}]')
    })

    it('should serialize long arrays with a bounded preview', async () => {
      const array = [1, 'string', true, null, 5, 6]

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log(array)
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('[1, "string", true, null, 5, ...]')
    })
  })

  describe('DOM-like object serialization', () => {
    it('should serialize DOM element properties', async () => {
      const domLike = { tagName: 'DIV', id: 'app', className: 'container' }

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log(domLike)
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('<div#app.container>')
    })

    it('should serialize DOM-like objects with nested properties', async () => {
      const domLike = {
        tagName: 'DIV',
        attributes: { id: 'app', class: 'container' },
        children: [],
      }

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log(domLike)
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('<div>')
    })
  })

  describe('Edge primitive serialization', () => {
    it('should serialize undefined', async () => {
      mockCapturedLogsResult([
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          level: 'log',
          message: 'undefined',
        },
      ])

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('undefined')
    })

    it('should serialize null', async () => {
      mockCapturedLogsResult([
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          level: 'log',
          message: 'null',
        },
      ])

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('null')
    })

    it('should serialize BigInt values', async () => {
      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log(BigInt(9007199254740991))
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('9007199254740991n')
    })

    it('should serialize Symbol values', async () => {
      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log(Symbol('test'))
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('Symbol(test)')
    })
  })

  describe('Multiple argument serialization', () => {
    it('should serialize multiple arguments joined by spaces', async () => {
      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.log('first', 'second', { key: 'value' })
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe('first second {key: "value"}')
    })

    it('should serialize error objects with additional context', async () => {
      const error = new TypeError('Failed to read property')
      error.stack = 'TypeError: Failed to read property\n    at request (api.js:5:10)'

      mockBootstrapCapture((sandboxConsole) => {
        sandboxConsole.error(error, { url: '/api/users', method: 'GET' })
      })

      const logs = await captureConsoleLogs()

      expect(logs[0].message).toBe(
        'TypeError: Failed to read property at request (api.js:5:10) {url: "/api/users", method: "GET"}'
      )
    })
  })

  describe('Runtime failure capture', () => {
    it('captures uncaught sync errors as canonical error events', async () => {
      mockBootstrapCapture((_sandboxConsole, sandboxWindow) => {
        const error = new TypeError("Cannot read properties of undefined (reading 'id')")

        sandboxWindow.onerror?.call(
          sandboxWindow,
          error.message,
          'https://example.test/app.js',
          10,
          5,
          error
        )
      })

      const logs = await captureConsoleLogs()

      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        level: 'error',
        message:
          "Uncaught TypeError: Cannot read properties of undefined (reading 'id') at https://example.test/app.js:10:5",
      })
    })

    it('captures unhandled promise rejections with normalized reason text', async () => {
      mockBootstrapCapture((_sandboxConsole, sandboxWindow) => {
        sandboxWindow.onunhandledrejection?.({
          reason: new Error('Request queue stalled'),
        })
      })

      const logs = await captureConsoleLogs()

      expect(logs).toHaveLength(1)
      expect(logs[0]).toMatchObject({
        level: 'error',
        message: 'Unhandled promise rejection: Error: Request queue stalled',
      })
    })

    it('deduplicates uncaught errors that also reach console.error', async () => {
      mockBootstrapCapture((sandboxConsole, sandboxWindow) => {
        const error = new TypeError('Request failed')

        sandboxWindow.onerror?.call(sandboxWindow, error.message, 'app.js', 4, 2, error)
        sandboxConsole.error(error)
      })

      const logs = await captureConsoleLogs()

      expect(logs).toHaveLength(1)
      expect(logs[0]?.message).toBe('Uncaught TypeError: Request failed at app.js:4:2')
    })

    it('preserves original global error handlers', async () => {
      const originalOnError = vi.fn(() => true)
      const originalOnUnhandledRejection = vi.fn(() => 'handled')

      mockBootstrapCapture(
        (_sandboxConsole, sandboxWindow) => {
          const error = new ReferenceError('missingConfig is not defined')

          const onErrorResult = sandboxWindow.onerror?.call(
            sandboxWindow,
            error.message,
            'config.js',
            8,
            1,
            error
          )
          const onUnhandledRejectionResult = sandboxWindow.onunhandledrejection?.({
            reason: 'config promise rejected',
          })

          expect(onErrorResult).toBe(true)
          expect(onUnhandledRejectionResult).toBe('handled')
        },
        {
          initialWindow: {
            onerror: originalOnError,
            onunhandledrejection: originalOnUnhandledRejection,
          },
        }
      )

      const logs = await captureConsoleLogs()

      expect(logs).toHaveLength(2)
      expect(originalOnError).toHaveBeenCalledWith(
        'missingConfig is not defined',
        'config.js',
        8,
        1,
        expect.any(ReferenceError)
      )
      expect(originalOnUnhandledRejection).toHaveBeenCalledWith({
        reason: 'config promise rejected',
      })
    })
  })

  describe('Log level preservation', () => {
    it('should preserve log level "log"', async () => {
      mockCapturedLogsResult([
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          level: 'log',
          message: 'log message',
        },
      ])

      const logs = await captureConsoleLogs()

      expect(logs[0].level).toBe('log')
    })

    it('should preserve log level "error"', async () => {
      mockCapturedLogsResult([
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          level: 'error',
          message: 'error message',
        },
      ])

      const logs = await captureConsoleLogs()

      expect(logs[0].level).toBe('error')
    })

    it('should preserve log level "warn"', async () => {
      mockCapturedLogsResult([
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          level: 'warn',
          message: 'warn message',
        },
      ])

      const logs = await captureConsoleLogs()

      expect(logs[0].level).toBe('warn')
    })

    it('should preserve log level "info"', async () => {
      mockCapturedLogsResult([
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          level: 'info',
          message: 'info message',
        },
      ])

      const logs = await captureConsoleLogs()

      expect(logs[0].level).toBe('info')
    })

    it('should preserve log level "debug"', async () => {
      mockCapturedLogsResult([
        {
          timestamp: '2024-01-15T10:30:00.000Z',
          level: 'debug',
          message: 'debug message',
        },
      ])

      const logs = await captureConsoleLogs()

      expect(logs[0].level).toBe('debug')
    })
  })

  describe('Timestamp format', () => {
    it('should use ISO 8601 timestamp format', async () => {
      mockCapturedLogsResult([
        {
          timestamp: '2024-01-15T10:30:00.123Z',
          level: 'log',
          message: 'test',
        },
      ])

      const logs = await captureConsoleLogs()

      expect(logs[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should preserve timezone offset if present', async () => {
      mockCapturedLogsResult([
        {
          timestamp: '2024-01-15T10:30:00.000-05:00',
          level: 'log',
          message: 'test',
        },
      ])

      const logs = await captureConsoleLogs()

      expect(logs[0].timestamp).toBe('2024-01-15T10:30:00.000-05:00')
    })
  })
})

describe('captureConsoleLogs - Error Handling', () => {
  it('should handle empty log array', async () => {
    mockCapturedLogsResult([])

    const logs = await captureConsoleLogs()

    expect(logs).toEqual([])
  })

  it('should handle null result from eval', async () => {
    mockCapturedLogsResult(null)

    const logs = await captureConsoleLogs()

    expect(logs).toEqual([])
  })

  it('should handle undefined result from eval', async () => {
    mockCapturedLogsResult(undefined)

    const logs = await captureConsoleLogs()

    expect(logs).toEqual([])
  })

  it('should reject on exception from eval', async () => {
    mockCapturedLogsResult(undefined, true)

    await expect(captureConsoleLogs()).rejects.toThrow('Failed to capture console logs')
  })
})

describe('captureNetworkEntries - Fetch/XHR Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockHARResponse(entries: HAREntry[]): void {
    mockChromeGetHAR.mockImplementationOnce(
      (callback: (harLog: { entries: HAREntry[] }) => void) => {
        callback({ entries })
      }
    )
  }

  const apiEntries: HAREntry[] = [
    {
      startedDateTime: '2024-01-15T10:30:00Z',
      request: { url: 'https://api.example.com/v1/users', method: 'GET' },
      response: { status: 200, statusText: 'OK', content: { mimeType: 'application/json' } },
      _resourceType: 'Fetch',
    },
    {
      startedDateTime: '2024-01-15T10:30:01Z',
      request: { url: 'https://api.example.com/v1/posts', method: 'POST' },
      response: { status: 201, statusText: 'Created', content: { mimeType: 'application/json' } },
      _resourceType: 'XHR',
    },
  ]

  const nonApiEntries: HAREntry[] = [
    {
      startedDateTime: '2024-01-15T10:30:02Z',
      request: { url: 'https://example.com/', method: 'GET' },
      response: { status: 200, statusText: 'OK', content: { mimeType: 'text/html' } },
      _resourceType: 'Document',
    },
    {
      startedDateTime: '2024-01-15T10:30:03Z',
      request: { url: 'https://cdn.example.com/app.js', method: 'GET' },
      response: { status: 200, statusText: 'OK', content: { mimeType: 'text/javascript' } },
      _resourceType: 'Script',
    },
    {
      startedDateTime: '2024-01-15T10:30:04Z',
      request: { url: 'https://cdn.example.com/logo.png', method: 'GET' },
      response: { status: 200, statusText: 'OK', content: { mimeType: 'image/png' } },
      _resourceType: 'Image',
    },
    {
      startedDateTime: '2024-01-15T10:30:05Z',
      request: { url: 'https://cdn.example.com/styles.css', method: 'GET' },
      response: { status: 200, statusText: 'OK', content: { mimeType: 'text/css' } },
      _resourceType: 'Stylesheet',
    },
  ]

  it('should include Fetch entries', async () => {
    mockHARResponse([apiEntries[0]])

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(1)
    expect(entries[0]._resourceType).toBe('Fetch')
  })

  it('should include XHR entries', async () => {
    mockHARResponse([apiEntries[1]])

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(1)
    expect(entries[0]._resourceType).toBe('XHR')
  })

  it('should exclude Document entries', async () => {
    mockHARResponse(nonApiEntries)

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(0)
  })

  it('should exclude Script entries', async () => {
    mockHARResponse([nonApiEntries[1]])

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(0)
  })

  it('should exclude Image entries', async () => {
    mockHARResponse([nonApiEntries[2]])

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(0)
  })

  it('should exclude Stylesheet entries', async () => {
    mockHARResponse([nonApiEntries[3]])

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(0)
  })

  it('should filter mixed entries to only fetch/XHR', async () => {
    mockHARResponse([...apiEntries, ...nonApiEntries])

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(2)
    expect(entries.every((e) => e._resourceType === 'Fetch' || e._resourceType === 'XHR')).toBe(
      true
    )
  })

  it('should pass through entries without _resourceType (Firefox compat)', async () => {
    const noTypeEntry: HAREntry = {
      startedDateTime: '2024-01-15T10:30:00Z',
      request: { url: 'https://api.example.com/v1/data', method: 'GET' },
      response: { status: 200, statusText: 'OK', content: { mimeType: 'application/json' } },
    }

    mockHARResponse([noTypeEntry])

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(1)
  })

  it('should handle case-insensitive _resourceType matching', async () => {
    const entry: HAREntry = {
      startedDateTime: '2024-01-15T10:30:00Z',
      request: { url: 'https://api.example.com/v1/data', method: 'GET' },
      response: { status: 200, statusText: 'OK' },
      _resourceType: 'FETCH',
    }

    mockHARResponse([entry])

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(1)
  })

  it('should return empty array when all entries are non-API types', async () => {
    mockHARResponse(nonApiEntries)

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(0)
  })

  it('should return empty array when HAR has no entries', async () => {
    mockHARResponse([])

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(0)
  })

  it('should pass through all entries when none have _resourceType', async () => {
    const noTypeEntries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://api.example.com/v1/users', method: 'GET' },
        response: { status: 200, statusText: 'OK' },
      },
      {
        startedDateTime: '2024-01-15T10:30:01Z',
        request: { url: 'https://cdn.example.com/logo.png', method: 'GET' },
        response: { status: 200, statusText: 'OK' },
      },
    ]

    mockHARResponse(noTypeEntries)

    const entries = await captureNetworkEntries()

    expect(entries).toHaveLength(2)
  })
})

describe('Response Body Capture', () => {
  function makeRequest(
    overrides?: Partial<DevToolsNetworkRequest> & {
      request?: Partial<DevToolsNetworkRequest['request']>
      response?: Partial<DevToolsNetworkRequest['response']>
    }
  ): DevToolsNetworkRequest {
    return {
      request: {
        url: overrides?.request?.url ?? 'https://api.example.com/v1/users',
      },
      response: {
        content: {
          mimeType: overrides?.response?.content?.mimeType ?? 'application/json',
        },
      },
      startedDateTime: overrides?.startedDateTime ?? '2024-01-15T10:30:00.000Z',
      getContent: overrides?.getContent ?? ((callback) => callback('{"ok":true}', '')),
    }
  }

  function makeEntry(
    overrides?: Omit<Partial<HAREntry>, 'request' | 'response'> & {
      request?: Partial<HAREntry['request']>
      response?: Partial<HAREntry['response']>
    }
  ): HAREntry {
    return {
      startedDateTime: overrides?.startedDateTime ?? '2024-01-15T10:30:00.000Z',
      request: {
        method: overrides?.request?.method ?? 'GET',
        url: overrides?.request?.url ?? 'https://api.example.com/v1/users',
      },
      response: {
        status: overrides?.response?.status ?? 200,
        statusText: overrides?.response?.statusText ?? 'OK',
        content: {
          mimeType: overrides?.response?.content?.mimeType ?? 'application/json',
          text: overrides?.response?.content?.text,
        },
      },
      _resourceType: overrides?._resourceType,
    }
  }

  beforeEach(() => {
    stopResponseBodyCapture()
    clearResponseBodies()
    vi.clearAllMocks()
  })

  it('startResponseBodyCapture registers an onRequestFinished listener', () => {
    startResponseBodyCapture()

    expect(mockChromeOnRequestFinished).toHaveBeenCalledTimes(1)
    expect(mockChromeOnRequestFinished.mock.calls[0][0]).toBeTypeOf('function')
  })

  it('startResponseBodyCapture does not register twice if already listening', () => {
    startResponseBodyCapture()
    startResponseBodyCapture()

    expect(mockChromeOnRequestFinished).toHaveBeenCalledTimes(1)
  })

  it('Response bodies are cached when getContent provides content', () => {
    startResponseBodyCapture()
    const listener = mockChromeOnRequestFinished.mock.calls[0][0] as (
      request: DevToolsNetworkRequest
    ) => void

    listener(makeRequest())

    const [enrichedEntry] = enrichWithResponseBodies([makeEntry()])
    expect(enrichedEntry.response.content?.text).toBe('{"ok":true}')
  })

  it('Response bodies with empty/undefined content are not cached', () => {
    startResponseBodyCapture()
    const listener = mockChromeOnRequestFinished.mock.calls[0][0] as (
      request: DevToolsNetworkRequest
    ) => void

    listener(makeRequest({ getContent: (callback) => callback('', '') }))
    listener(
      makeRequest({
        startedDateTime: '2024-01-15T10:30:01.000Z',
        getContent: () => {},
      })
    )

    const enriched = enrichWithResponseBodies([
      makeEntry(),
      makeEntry({ startedDateTime: '2024-01-15T10:30:01.000Z' }),
    ])

    expect(enriched[0].response.content?.text).toBeUndefined()
    expect(enriched[1].response.content?.text).toBeUndefined()
  })

  it('stopResponseBodyCapture removes the listener', () => {
    startResponseBodyCapture()
    const listener = mockChromeOnRequestFinished.mock.calls[0][0] as (
      request: DevToolsNetworkRequest
    ) => void

    stopResponseBodyCapture()

    expect(mockChromeOnRequestFinishedRemove).toHaveBeenCalledTimes(1)
    expect(mockChromeOnRequestFinishedRemove).toHaveBeenCalledWith(listener)
  })

  it('clearResponseBodies empties the cache', () => {
    startResponseBodyCapture()
    const listener = mockChromeOnRequestFinished.mock.calls[0][0] as (
      request: DevToolsNetworkRequest
    ) => void

    listener(makeRequest())
    clearResponseBodies()

    const [enrichedEntry] = enrichWithResponseBodies([makeEntry()])
    expect(enrichedEntry.response.content?.text).toBeUndefined()
  })

  it('enrichWithResponseBodies merges cached body into entry missing response.content.text', () => {
    startResponseBodyCapture()
    const listener = mockChromeOnRequestFinished.mock.calls[0][0] as (
      request: DevToolsNetworkRequest
    ) => void

    listener(makeRequest({ getContent: (callback) => callback('{"id":1}', '') }))

    const [enrichedEntry] = enrichWithResponseBodies([makeEntry()])
    expect(enrichedEntry.response.content?.text).toBe('{"id":1}')
  })

  it('enrichWithResponseBodies does not overwrite existing response.content.text', () => {
    startResponseBodyCapture()
    const listener = mockChromeOnRequestFinished.mock.calls[0][0] as (
      request: DevToolsNetworkRequest
    ) => void

    listener(makeRequest({ getContent: (callback) => callback('{"cached":true}', '') }))

    const [enrichedEntry] = enrichWithResponseBodies([
      makeEntry({ response: { content: { text: '{"existing":true}' } } }),
    ])

    expect(enrichedEntry.response.content?.text).toBe('{"existing":true}')
  })

  it('enrichWithResponseBodies does not mutate original entries', () => {
    startResponseBodyCapture()
    const listener = mockChromeOnRequestFinished.mock.calls[0][0] as (
      request: DevToolsNetworkRequest
    ) => void

    listener(makeRequest({ getContent: (callback) => callback('{"cached":true}', '') }))

    const originalEntry = makeEntry()
    const originalContent = originalEntry.response.content
    const enriched = enrichWithResponseBodies([originalEntry])

    expect(enriched[0]).not.toBe(originalEntry)
    expect(enriched[0].response.content).not.toBe(originalContent)
    expect(originalEntry.response.content?.text).toBeUndefined()
    expect(enriched[0].response.content?.text).toBe('{"cached":true}')
  })

  it('enrichWithResponseBodies handles entries with no matching cache entry (returns unchanged)', () => {
    const originalEntry = makeEntry()
    const [resultEntry] = enrichWithResponseBodies([originalEntry])

    expect(resultEntry).toBe(originalEntry)
    expect(resultEntry.response.content?.text).toBeUndefined()
  })
})
