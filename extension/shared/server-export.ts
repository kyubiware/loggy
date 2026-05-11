/**
 * POST exported markdown to a configured server endpoint by delegating to
 * the background service worker.
 *
 * The actual fetch() runs in the background context to avoid CORS issues in
 * Firefox DevTools panel pages (moz-extension:// origin).
 */
export async function pushToServer(url: string, markdown: string): Promise<boolean> {
  try {
    console.log('[Loggy:panel] pushToServer called, url:', url, 'markdown length:', markdown.length)
    return await new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'push-to-server', url, markdown },
        (response: { success: boolean } | undefined) => {
          console.log('[Loggy:panel] pushToServer got response:', response, 'lastError:', chrome.runtime.lastError?.message)
          if (chrome.runtime.lastError) {
            console.error('[Loggy] Server export failed:', chrome.runtime.lastError.message)
            resolve(false)
            return
          }
          const result = response?.success ?? false
          console.log('[Loggy:panel] pushToServer resolving with:', result)
          resolve(result)
        },
      )
    })
  } catch (error) {
    console.error('[Loggy:panel] pushToServer caught error:', error)
    return false
  }
}
