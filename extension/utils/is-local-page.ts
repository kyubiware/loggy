/**
 * Returns true for local development URLs: localhost, 127.0.0.1, and file:// protocol.
 */
export function isLocalPage(url: string): boolean {
  if (!url) return false

  try {
    const parsedUrl = new URL(url)

    if (parsedUrl.protocol === 'file:') {
      return true
    }

    return parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'
  } catch {
    return false
  }
}
