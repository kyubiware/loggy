/**
 * Write text to the clipboard using the modern async Clipboard API,
 * falling back to a hidden textarea + execCommand('copy') when the
 * async API is unavailable or rejects (common in Firefox extension
 * contexts such as DevTools panels and popups).
 */
export async function writeClipboard(text: string): Promise<void> {
  // Try the modern async API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Fall through to execCommand fallback
    }
  }

  // Fallback: hidden textarea + execCommand('copy')
  const textarea = document.createElement('textarea')
  textarea.value = text
  // Position off-screen to avoid visual flash
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '-9999px'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    const ok = document.execCommand('copy')
    if (!ok) {
      throw new Error('execCommand("copy") returned false')
    }
  } finally {
    document.body.removeChild(textarea)
  }
}
