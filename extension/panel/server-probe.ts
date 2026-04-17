const HANDSHAKE_PATH = '/loggy/handshake'
const PROBE_TIMEOUT_MS = 1000

interface HandshakeResponse {
  name?: unknown
}

function createHandshakeUrl(url: string): string {
  const normalizedBaseUrl = url.replace(/\/+$/, '')
  return `${normalizedBaseUrl}${HANDSHAKE_PATH}`
}

/**
 * Probes a loggy-serve endpoint by calling its handshake route.
 * Returns true only when the endpoint responds with JSON containing name: 'loggy-serve'.
 */
export async function probeServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(createHandshakeUrl(url), {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })

    if (!response.ok) {
      return false
    }

    const data = (await response.json()) as HandshakeResponse
    return data.name === 'loggy-serve'
  } catch {
    return false
  }
}
