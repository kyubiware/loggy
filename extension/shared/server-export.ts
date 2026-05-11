/**
 * POST exported markdown to a configured server endpoint by delegating to
 * the background service worker.
 *
 * The actual fetch() runs in the background context to avoid CORS issues in
 * Firefox DevTools panel pages (moz-extension:// origin).
 */
export async function pushToServer(url: string, markdown: string): Promise<boolean> {
  try {
    return await new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'push-to-server', url, markdown },
        (response: { success: boolean } | undefined) => {
          if (chrome.runtime.lastError) {
            console.error('[Loggy] Server export failed:', chrome.runtime.lastError.message)
            resolve(false)
            return
          }
          resolve(response?.success ?? false)
        },
      )
    })
  } catch (error) {
    console.error('[Loggy] Server export failed:', error)
    return false
  }
}
