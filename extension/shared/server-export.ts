/**
 * POST exported markdown to a configured server endpoint by delegating to
 * the background service worker.
 *
 * The actual fetch() runs in the background context to avoid CORS issues in
 * Firefox DevTools panel pages (moz-extension:// origin).
 */
import { browser } from '../browser-apis'
import { debugLog } from '../utils/debug-logger.js'

export async function pushToServer(url: string, markdown: string): Promise<boolean> {
  try {
    debugLog('message', 'panel', `pushToServer SENDING: url=${url} (${markdown.length} chars)`)
    const response = await browser.runtime.sendMessage<{ success: boolean }>({
      type: 'push-to-server', url, markdown,
    })
    const result = response?.success ?? false
    debugLog('message', 'panel', `pushToServer RESOLVED: ${result}`, { url })
    return result
  } catch (error) {
    debugLog('message', 'panel', 'pushToServer FAILED', { error, url })
    return false
  }
}
