/**
 * Probes a loggy-serve endpoint by delegating to the background service worker.
 * Returns true only when the endpoint responds with JSON containing name: 'loggy-serve'.
 *
 * The actual fetch() runs in the background context to avoid CORS issues in
 * Firefox DevTools panel pages (moz-extension:// origin).
 */
export async function probeServer(url: string): Promise<boolean> {
  try {
    return await new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'probe-server', url },
        (response: { connected: boolean } | undefined) => {
          if (chrome.runtime.lastError) {
            console.error('[Loggy] Server probe failed:', chrome.runtime.lastError.message)
            resolve(false)
            return
          }
          resolve(response?.connected ?? false)
        }
      )
    })
  } catch {
    return false
  }
}
