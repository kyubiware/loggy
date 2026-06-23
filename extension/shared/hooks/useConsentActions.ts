import { useCallback } from 'react'
import { browser } from '../../browser-apis'

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
 * Centralizes the browser.runtime.sendMessage pattern so popup and panel
 * cannot drift out of sync.
 */
export function useConsentActions({
  tabId,
  host,
  onStateChanged,
}: UseConsentActionsOptions) {
  const handleStartLogging = useCallback(() => {
    if (tabId === undefined) return
    browser.runtime.sendMessage({ type: 'start-logging', tabId })
      .then(() => onStateChanged())
      .catch(() => undefined)
  }, [tabId, onStateChanged])

  const handleStopLogging = useCallback(() => {
    if (tabId === undefined) return
    browser.runtime.sendMessage({ type: 'stop-logging', tabId })
      .then(() => onStateChanged())
      .catch(() => undefined)
    if (host) {
      browser.runtime.sendMessage({ type: 'remove-always-log', host })
        .catch(() => undefined)
    }
  }, [tabId, host, onStateChanged])

  const handleAlwaysLog = useCallback(() => {
    if (!host) return
    browser.runtime.sendMessage({ type: 'add-always-log', host })
      .then(() => onStateChanged())
      .catch(() => undefined)
  }, [host, onStateChanged])

  return { handleStartLogging, handleStopLogging, handleAlwaysLog }
}
