/**
 * POST exported markdown to a configured server endpoint by delegating to
 * the background service worker.
 *
 * The actual fetch() runs in the background context to avoid CORS issues in
 * Firefox DevTools panel pages (moz-extension:// origin).
 */
import { debugLog } from '../utils/debug-logger.js'

export async function pushToServer(url: string, markdown: string): Promise<boolean> {
  try {
    debugLog('message', 'panel', `pushToServer SENDING: url=${url} (${markdown.length} chars)`)
    return await new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'push-to-server', url, markdown },
        (response: { success: boolean } | undefined) => {
          if (chrome.runtime.lastError) {
            debugLog('message', 'panel', `pushToServer FAILED: ${chrome.runtime.lastError.message}`, { url })
            resolve(false)
            return
          }
          const result = response?.success ?? false
          debugLog('message', 'panel', `pushToServer RESOLVED: ${result}`, { url })
          resolve(result)
        },
      )
    })
  } catch (error) {
    debugLog('message', 'panel', 'pushToServer CAUGHT error', { error, url })
    return false
  }
}
