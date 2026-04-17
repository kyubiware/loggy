import { afterEach, describe, expect, it, vi } from 'vitest'
import { pushToServer } from './server-export'

describe('pushToServer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns true when server responds with success', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    const result = await pushToServer('https://example.com', '# markdown')

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/loggy', {
      method: 'POST',
      body: '# markdown',
      headers: {
        'Content-Type': 'text/plain',
      },
      signal: expect.any(AbortSignal),
    })
  })

  it('returns false when server responds with non-2xx', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', mockFetch)

    const result = await pushToServer('https://example.com', '# markdown')

    expect(result).toBe(false)
  })

  it('returns false when fetch throws', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', mockFetch)

    const result = await pushToServer('https://example.com', '# markdown')

    expect(result).toBe(false)
  })

  it('appends /loggy path and strips trailing slash', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    await pushToServer('http://localhost:8743/', '# markdown')

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8743/loggy', expect.anything())
  })
})
