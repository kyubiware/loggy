import { useCallback } from 'react'

export interface UseConsentActionsOptions {
  /** Active tab ID to send commands for. */
  tabId: number | undefined
  /** Current page host for always-log operations. */
  host: string
  /** Called after any action completes so the caller can refresh state from the background. */
  onStateChanged: () => void
}

/**
 * Shared consent action handlers for start/stop logging and always-log.
 * Centralizes the chrome.runtime.sendMessage pattern so popup and panel
 * cannot drift out of sync.
 */
export function useConsentActions({
  tabId,
  host,
  onStateChanged,
}: UseConsentActionsOptions) {
  const handleStartLogging = useCallback(() => {
    if (tabId === undefined) return
    chrome.runtime.sendMessage(
      { type: 'start-logging', tabId },
      () => onStateChanged(),
    )
  }, [tabId, onStateChanged])

  const handleStopLogging = useCallback(() => {
    if (tabId === undefined) return
    chrome.runtime.sendMessage(
      { type: 'stop-logging', tabId },
      () => onStateChanged(),
    )
    if (host) {
      chrome.runtime.sendMessage({ type: 'remove-always-log', host })
    }
  }, [tabId, host, onStateChanged])

  const handleAlwaysLog = useCallback(() => {
    if (!host) return
    chrome.runtime.sendMessage(
      { type: 'add-always-log', host },
      () => onStateChanged(),
    )
  }, [host, onStateChanged])

  return { handleStartLogging, handleStopLogging, handleAlwaysLog }
}
