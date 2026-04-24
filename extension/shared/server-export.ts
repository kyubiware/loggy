const EXPORT_PATH = '/loggy'

function createExportUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  return `${normalizedBaseUrl}${EXPORT_PATH}`
}

/**
 * POST exported markdown to a configured server endpoint.
 * Returns true on successful (2xx) response, false on timeout/network/error.
 */
export async function pushToServer(url: string, markdown: string): Promise<boolean> {
  try {
    const response = await fetch(createExportUrl(url), {
      method: 'POST',
      body: markdown,
      headers: {
        'Content-Type': 'text/plain',
      },
      signal: AbortSignal.timeout(3000),
    })

    if (!response.ok) {
      console.error(`[Loggy] Server export failed: HTTP ${response.status} ${response.statusText}`)
      return false
    }

    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      console.error('[Loggy] Server export failed: Request timed out after 3s')
    } else if (error instanceof TypeError) {
      console.error(`[Loggy] Server export failed: Network error - ${error.message}`)
    } else {
      console.error('[Loggy] Server export failed:', error)
    }
    return false
  }
}
