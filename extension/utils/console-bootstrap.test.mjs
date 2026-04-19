import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

const bootstrapSourcePath = path.join(process.cwd(), 'utils/console-bootstrap.mjs')
const rawBootstrapSource = readFileSync(bootstrapSourcePath, 'utf8')
const executableBootstrapSource = rawBootstrapSource.replace(
  /\nexport const CONSOLE_BOOTSTRAP_SCRIPT[\s\S]*$/,
  '\n'
)

const originalConsoleMethods = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
}

const originalFetch = globalThis.fetch
const originalXHR = globalThis.XMLHttpRequest

function runBootstrap() {
  window.eval(executableBootstrapSource)
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function createMockXMLHttpRequestClass() {
  return class MockXMLHttpRequest {
    constructor() {
      this.status = 0
      this.listeners = new Map()
    }

    open(method, url) {
      this.method = method
      this.url = url
    }

    addEventListener(type, listener, options) {
      const entries = this.listeners.get(type) ?? []
      entries.push({ listener, once: Boolean(options?.once) })
      this.listeners.set(type, entries)
    }

    send() {
      const entries = this.listeners.get('loadend') ?? []

      for (const entry of entries) {
        entry.listener.call(this)
      }

      this.listeners.set(
        'loadend',
        entries.filter((entry) => !entry.once)
      )
    }
  }
}

beforeEach(() => {
  delete window.__loggyConsoleCaptureInstalled
  delete window.__loggyConsoleLogs
  delete window.__loggyNetworkLogs
  window.fetch = vi.fn()
  window.XMLHttpRequest = createMockXMLHttpRequestClass()
  window.postMessage = vi.fn()
})

afterEach(() => {
  delete window.__loggyConsoleCaptureInstalled
  delete window.__loggyConsoleLogs
  delete window.__loggyNetworkLogs
  console.log = originalConsoleMethods.log
  console.warn = originalConsoleMethods.warn
  console.error = originalConsoleMethods.error
  console.info = originalConsoleMethods.info
  console.debug = originalConsoleMethods.debug
  window.fetch = originalFetch
  window.XMLHttpRequest = originalXHR
  vi.restoreAllMocks()
})

describe('console bootstrap network buffer', () => {
  test('initializes network buffer as empty array', () => {
    runBootstrap()

    expect(Array.isArray(window.__loggyNetworkLogs)).toBe(true)
    expect(window.__loggyNetworkLogs).toHaveLength(0)
  })

  test('preserves existing network buffer entries', () => {
    const existing = [{ url: 'https://example.test/existing', method: 'GET', status: 200 }]
    window.__loggyNetworkLogs = existing

    runBootstrap()

    expect(window.__loggyNetworkLogs).toBe(existing)
    expect(window.__loggyNetworkLogs).toHaveLength(1)
  })

  test('pushes entry on fetch success', async () => {
    window.fetch = vi.fn().mockResolvedValue({
      url: 'https://example.test/users',
      status: 201,
      headers: {
        get: vi.fn().mockReturnValue('application/json'),
      },
      clone: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue('{"ok":true}'),
      }),
    })

    runBootstrap()

    await window.fetch('https://example.test/users', { method: 'POST' })
    await flushMicrotasks()

    expect(window.__loggyNetworkLogs).toHaveLength(1)
    expect(window.__loggyNetworkLogs[0]).toMatchObject({
      url: 'https://example.test/users',
      method: 'POST',
      status: 201,
      contentType: 'application/json',
      responseBodyPreview: '{"ok":true}',
    })
  })

  test('pushes entry on fetch error', async () => {
    window.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    runBootstrap()

    await expect(window.fetch('https://example.test/fail', { method: 'GET' })).rejects.toThrow(
      'network down'
    )

    expect(window.__loggyNetworkLogs).toHaveLength(1)
    expect(window.__loggyNetworkLogs[0]).toMatchObject({
      url: 'https://example.test/fail',
      method: 'GET',
      status: 0,
      error: 'network down',
    })
  })

  test('pushes entry on XHR loadend', () => {
    runBootstrap()

    const xhr = new window.XMLHttpRequest()
    xhr.open('PATCH', 'https://example.test/xhr')
    xhr.status = 204
    xhr.send()

    expect(window.__loggyNetworkLogs).toHaveLength(1)
    expect(window.__loggyNetworkLogs[0]).toMatchObject({
      url: 'https://example.test/xhr',
      method: 'PATCH',
      status: 204,
    })
  })

  test('evicts oldest entries with circular buffer at 500', async () => {
    window.fetch = vi.fn((url) =>
      Promise.reject(new Error(`failed ${String(url)}`))
    )

    runBootstrap()

    for (let i = 0; i < 505; i += 1) {
      await expect(window.fetch(`https://example.test/${i}`)).rejects.toThrow()
    }

    expect(window.__loggyNetworkLogs).toHaveLength(500)
    expect(window.__loggyNetworkLogs[0].url).toBe('https://example.test/5')
    expect(window.__loggyNetworkLogs[499].url).toBe('https://example.test/504')
  })

  test('network buffer entries remain JSON serializable', async () => {
    window.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        url: 'https://example.test/success',
        status: 200,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        clone: vi.fn().mockReturnValue({ text: vi.fn().mockResolvedValue('{"a":1}') }),
      })
      .mockRejectedValueOnce(new Error('boom'))

    runBootstrap()

    await window.fetch('https://example.test/success')
    await flushMicrotasks()
    await expect(window.fetch('https://example.test/error')).rejects.toThrow('boom')

    const xhr = new window.XMLHttpRequest()
    xhr.open('GET', 'https://example.test/xhr-json')
    xhr.status = 200
    xhr.send()

    expect(() => JSON.stringify(window.__loggyNetworkLogs)).not.toThrow()
    expect(JSON.parse(JSON.stringify(window.__loggyNetworkLogs))).toHaveLength(3)
  })

  test('console buffer works independently from network buffer', () => {
    runBootstrap()

    console.log('hello from console buffer')

    expect(window.__loggyConsoleLogs).toHaveLength(1)
    expect(window.__loggyConsoleLogs[0].level).toBe('log')
    expect(window.__loggyNetworkLogs).toHaveLength(0)
  })
})
