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

    // Preserve the vitest.setup.ts full chrome mock and merge devtools-specific
    // overrides on top. chrome.ts accesses chrome.runtime.* at module-load time,
    // so the full mock must remain intact.
    globalThis.chrome = {
      ...globalThis.chrome,
      devtools: {
        ...((globalThis.chrome as Record<string, unknown>)?.devtools as Record<string, unknown>),
        panels: {
          create: mockCreatePanel,
        },
        inspectedWindow: {
          eval: mockEval,
        },
        network: {
          ...(((globalThis.chrome as Record<string, unknown>)?.devtools as Record<string, unknown>)
            ?.network as Record<string, unknown>),
          onNavigated: {
            addListener: mockOnNavigatedAddListener,
          },
        },
      },
    } as unknown as typeof chrome

    // NOTE: globalThis.browser is a live getter pointing to globalThis.chrome
    // (set up in vitest.setup.firefox.ts), so the reassignment above is
    // automatically reflected in browser.* — no manual sync needed.
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
