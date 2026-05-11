import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { probeServer } from './server-probe'

const mockSendMessage = vi.fn()

beforeEach(() => {
  mockSendMessage.mockReset()
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: mockSendMessage,
      lastError: undefined as Error | undefined,
    },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('probeServer', () => {
  it('returns true when background reports server connected', async () => {
    mockSendMessage.mockImplementation(
      (_msg: unknown, callback: (response: { connected: boolean }) => void) => {
        callback({ connected: true })
      }
    )

    await expect(probeServer('http://localhost:8743')).resolves.toBe(true)
    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'probe-server', url: 'http://localhost:8743' },
      expect.any(Function)
    )
  })

  it('returns false when background reports server not connected', async () => {
    mockSendMessage.mockImplementation(
      (_msg: unknown, callback: (response: { connected: boolean }) => void) => {
        callback({ connected: false })
      }
    )

    await expect(probeServer('http://localhost:8743')).resolves.toBe(false)
  })

  it('returns false when chrome.runtime.lastError is set', async () => {
    mockSendMessage.mockImplementation((_msg: unknown, callback: (response: undefined) => void) => {
      vi.stubGlobal('chrome', {
        runtime: {
          sendMessage: mockSendMessage,
          lastError: new Error('Extension context invalidated'),
        },
      })
      callback(undefined)
    })

    await expect(probeServer('http://localhost:8743')).resolves.toBe(false)
  })

  it('returns false when response is undefined', async () => {
    mockSendMessage.mockImplementation((_msg: unknown, callback: (response: undefined) => void) => {
      callback(undefined)
    })

    await expect(probeServer('http://localhost:8743')).resolves.toBe(false)
  })

  it('returns false on unexpected errors', async () => {
    mockSendMessage.mockImplementation(() => {
      throw new Error('unexpected')
    })

    await expect(probeServer('http://localhost:8743')).resolves.toBe(false)
  })
})
