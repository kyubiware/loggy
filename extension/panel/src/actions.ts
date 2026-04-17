import { buildExportMarkdown, triggerServerExport } from '../export'
import type { LoggyState } from '../state'

type ShowToastFn = (message: string, type: 'success' | 'error') => void

/**
 * Copy filtered logs as Markdown to the clipboard.
 * Shows a success or error toast based on the result.
 */
export async function copyAction(state: LoggyState, showToast: ShowToastFn): Promise<void> {
  try {
    const markdown = await buildExportMarkdown(state)
    triggerServerExport(state, markdown, showToast)
    await navigator.clipboard.writeText(markdown)
    showToast('Copied to clipboard!', 'success')
  } catch {
    showToast('Failed to copy to clipboard', 'error')
  }
}

/**
 * Clear all captured console and network data.
 * Delegates clearing behavior to the provided clearData callback.
 * Shows a success or error toast based on the result.
 */
export async function clearAction(
  clearData: () => Promise<void>,
  showToast: ShowToastFn
): Promise<void> {
  try {
    await clearData()
    showToast('Logs cleared', 'success')
  } catch {
    showToast('Failed to clear logs', 'error')
  }
}
