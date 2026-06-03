import { useCallback, useEffect, useState } from 'react'
import { useConsentActions } from '../../../shared/hooks/useConsentActions'
import type { ConsentState } from '../../../types/messages'

type ConsentCheckState = 'checking' | 'not-consented' | 'consented'

export function useConsentCheck() {
  // State
  const [consentState, setConsentState] = useState<ConsentCheckState>('checking')
  const [host, setHost] = useState('')

  // On mount: get tabId, check consent, get host
  useEffect(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId
    if (typeof tabId !== 'number') {
      setConsentState('not-consented')
      return
    }

    // Check consent via background
    chrome.runtime.sendMessage({ type: 'request-consent', tabId }, (response: ConsentState) => {
      if (response?.hasConsent) {
        setConsentState('consented')
      } else {
        setConsentState('not-consented')
      }
    })

    // Get host for display
    chrome.devtools.inspectedWindow.eval(
      'document.location.hostname',
      (result: unknown, exceptionInfo: chrome.devtools.inspectedWindow.EvaluationExceptionInfo) => {
        if (!exceptionInfo.isException && typeof result === 'string') {
          setHost(result)
        }
      }
    )
  }, [])

  const refreshConsent = useCallback(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId
    if (typeof tabId !== 'number') return
    chrome.runtime.sendMessage({ type: 'request-consent', tabId }, (response: ConsentState) => {
      setConsentState(response?.hasConsent ? 'consented' : 'not-consented')
    })
  }, [])

  const tabId = chrome.devtools.inspectedWindow.tabId
  const { handleStartLogging, handleAlwaysLog } = useConsentActions({
    tabId,
    host,
    onStateChanged: refreshConsent,
  })

  return { consentState, host, handleStartLogging, handleAlwaysLog }
}
