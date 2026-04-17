import { afterEach, describe, expect, it, vi } from 'vitest'
import { probeServer } from './server-probe'

describe('probeServer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true for valid loggy-serve handshake response', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ name: 'loggy-serve' }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    await expect(probeServer('http://localhost:8743')).resolves.toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8743/loggy/handshake',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('normalizes trailing slash in base URL', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ name: 'loggy-serve' }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    await expect(probeServer('http://localhost:8743/')).resolves.toBe(true)
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:8743/loggy/handshake',
      expect.any(Object)
    )
  })

  it('returns false when HTTP response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn(),
      })
    )

    await expect(probeServer('http://localhost:8743')).resolves.toBe(false)
  })

  it('returns false when handshake JSON does not match expected name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ name: 'other-server' }),
      })
    )

    await expect(probeServer('http://localhost:8743')).resolves.toBe(false)
  })

  it('returns false on network or parsing failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))

    await expect(probeServer('http://localhost:8743')).resolves.toBe(false)
  })
})
