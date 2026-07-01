import { beforeEach, describe, expect, it, vi } from 'vitest'
import { injectIntoTab } from './content-scripts'

declare const __BROWSER__: string

describe('injectIntoTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('injects content-relay and console-bootstrap into the specified tab', async () => {
    await injectIntoTab(42)

    // Under Firefox, injectIntoTab also injects fab-ui.js
    const expectedCalls = __BROWSER__ === 'firefox' ? 3 : 2
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(expectedCalls)
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ['content-relay.js'],
    })
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ['chunks/console-bootstrap.js'],
      world: 'MAIN',
    })
    if (__BROWSER__ === 'firefox') {
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 42 },
        files: ['fab-ui.js'],
      })
    }
  })

  it('catches and logs injection errors without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(chrome.scripting.executeScript).mockRejectedValueOnce(new Error('Injection failed'))

    await expect(injectIntoTab(42)).resolves.not.toThrow()

    expect(errorSpy).toHaveBeenCalledWith(
      '[Loggy] Failed to inject content-relay.js:',
      expect.any(Error),
    )
    errorSpy.mockRestore()
  })

  it('continues injecting second script after first fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(chrome.scripting.executeScript).mockRejectedValueOnce(new Error('Failed'))

    await injectIntoTab(42)

    // Under Firefox, injectIntoTab also injects fab-ui.js (3 scripts total)
    const expectedCalls = __BROWSER__ === 'firefox' ? 3 : 2
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(expectedCalls)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })
})
