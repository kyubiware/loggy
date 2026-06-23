import { browser } from '../browser-apis/index.js'

/**
 * Probes a loggy-serve endpoint by delegating to the background service worker.
 * Returns true only when the endpoint responds with JSON containing name: 'loggy-serve'.
 *
 * The actual fetch() runs in the background context to avoid CORS issues in
 * Firefox DevTools panel pages (moz-extension:// origin).
 */
export async function probeServer(url: string): Promise<boolean> {
  try {
    const response = await browser.runtime.sendMessage<{ connected: boolean } | undefined>({
      type: 'probe-server',
      url,
    })
    return response?.connected ?? false
  } catch (error) {
    console.error('[Loggy:panel] probeServer:', error)
    return false
  }
}
