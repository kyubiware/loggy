import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pushToServer } from './server-export'

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

describe('pushToServer', () => {
  it('returns true when background reports success', async () => {
    mockSendMessage.mockImplementation(
      (_msg: unknown, callback: (response: { success: boolean }) => void) => {
        callback({ success: true })
      },
    )

    const result = await pushToServer('https://example.com', '# markdown')

    expect(result).toBe(true)
    expect(mockSendMessage).toHaveBeenCalledWith(
      { type: 'push-to-server', url: 'https://example.com', markdown: '# markdown' },
      expect.any(Function),
    )
  })

  it('returns false when background reports failure', async () => {
    mockSendMessage.mockImplementation(
      (_msg: unknown, callback: (response: { success: boolean }) => void) => {
        callback({ success: false })
      },
    )

    const result = await pushToServer('https://example.com', '# markdown')

    expect(result).toBe(false)
  })

  it('returns false when chrome.runtime.lastError is set', async () => {
    mockSendMessage.mockImplementation(
      (_msg: unknown, callback: (response: undefined) => void) => {
        vi.stubGlobal('chrome', {
          runtime: {
            sendMessage: mockSendMessage,
            lastError: new Error('Extension context invalidated'),
          },
        })
        callback(undefined)
      },
    )

    const result = await pushToServer('https://example.com', '# markdown')

    expect(result).toBe(false)
  })

  it('returns false when response is undefined', async () => {
    mockSendMessage.mockImplementation(
      (_msg: unknown, callback: (response: undefined) => void) => {
        callback(undefined)
      },
    )

    const result = await pushToServer('https://example.com', '# markdown')

    expect(result).toBe(false)
  })

  it('returns false on unexpected errors', async () => {
    mockSendMessage.mockImplementation(() => {
      throw new Error('unexpected')
    })

    const result = await pushToServer('https://example.com', '# markdown')

    expect(result).toBe(false)
  })
})
