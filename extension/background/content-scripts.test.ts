import { beforeEach, describe, expect, it, vi } from 'vitest'
import { injectIntoTab } from './content-scripts'

describe('injectIntoTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('injects content-relay and console-bootstrap into the specified tab', async () => {
    await injectIntoTab(42)

    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2)
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ['content-relay.js'],
    })
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42 },
      files: ['chunks/console-bootstrap.js'],
      world: 'MAIN',
    })
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

    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    errorSpy.mockRestore()
  })
})
