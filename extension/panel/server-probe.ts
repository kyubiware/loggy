/**
 * Probes a loggy-serve endpoint by delegating to the background service worker.
 * Returns true only when the endpoint responds with JSON containing name: 'loggy-serve'.
 *
 * The actual fetch() runs in the background context to avoid CORS issues in
 * Firefox DevTools panel pages (moz-extension:// origin).
 */
export async function probeServer(url: string): Promise<boolean> {
  try {
    console.log('[Loggy:panel] probeServer called with url:', url)
    return await new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'probe-server', url },
        (response: { connected: boolean } | undefined) => {
          console.log(
            '[Loggy:panel] probeServer got response:',
            response,
            'lastError:',
            chrome.runtime.lastError?.message
          )
          if (chrome.runtime.lastError) {
            console.error('[Loggy] Server probe failed:', chrome.runtime.lastError.message)
            resolve(false)
            return
          }
          const result = response?.connected ?? false
          console.log('[Loggy:panel] probeServer resolving with:', result)
          resolve(result)
        }
      )
    })
  } catch (error) {
    console.error('[Loggy:panel] probeServer caught error:', error)
    return false
  }
}
