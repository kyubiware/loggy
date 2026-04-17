import { beforeEach, describe, expect, test, vi } from 'vitest'

describe('devtools bootstrap', () => {
  const mockCreatePanel = vi.fn()
  const mockEval = vi.fn()
  const mockOnNavigatedAddListener = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    mockCreatePanel.mockReset()
    mockEval.mockReset()
    mockOnNavigatedAddListener.mockReset()

    globalThis.chrome = {
      devtools: {
        panels: {
          create: mockCreatePanel,
        },
        inspectedWindow: {
          eval: mockEval,
        },
        network: {
          onNavigated: {
            addListener: mockOnNavigatedAddListener,
          },
        },
      },
    } as unknown as typeof chrome
  })

  test('installs console capture immediately and on navigation', async () => {
    await import('./devtools.mjs')

    expect(mockCreatePanel).toHaveBeenCalledWith(
      'Loggy',
      'icons/icon16.png',
      'panel/index.html',
      expect.any(Function)
    )

    expect(mockEval).toHaveBeenCalledTimes(1)
    expect(mockEval).toHaveBeenCalledWith(
      expect.stringContaining('__loggyConsoleLogs'),
      expect.any(Function)
    )

    expect(mockOnNavigatedAddListener).toHaveBeenCalledTimes(1)

    const navigatedHandler = mockOnNavigatedAddListener.mock.calls[0][0] as () => void
    navigatedHandler()

    expect(mockEval).toHaveBeenCalledTimes(3)
  })

  test('clears captured console logs on navigation', async () => {
    await import('./devtools.mjs')

    const navigatedHandler = mockOnNavigatedAddListener.mock.calls[0][0] as () => void
    navigatedHandler()

    expect(mockEval).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('window.__loggyConsoleLogs = [];'),
      expect.any(Function)
    )
  })
})
