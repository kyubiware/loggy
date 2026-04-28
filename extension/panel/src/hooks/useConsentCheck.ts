import { useCallback, useEffect, useState } from 'react'
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

  const handleStartLogging = useCallback(() => {
    setConsentState('consented')
  }, [])

  const handleAlwaysLog = useCallback(() => {
    if (!host) return
    chrome.runtime.sendMessage({ type: 'add-always-log', host })
    setConsentState('consented')
  }, [host])

  return { consentState, host, handleStartLogging, handleAlwaysLog }
}
