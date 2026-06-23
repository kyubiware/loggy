import { useCallback, useEffect, useState } from 'react'
import { browser } from '../../../browser-apis/index.js'
import { useConsentActions } from '../../../shared/hooks/useConsentActions'
import type { ConsentState } from '../../../types/messages'

type ConsentCheckState = 'checking' | 'not-consented' | 'consented'

export function useConsentCheck() {
  // State
  const [consentState, setConsentState] = useState<ConsentCheckState>('checking')
  const [host, setHost] = useState('')

  // On mount: get tabId, check consent, get host
  useEffect(() => {
    const tabId = browser.devtools.inspectedWindow.tabId
    if (typeof tabId !== 'number') {
      setConsentState('not-consented')
      return
    }

    // Check consent via background
    browser.runtime
      .sendMessage<ConsentState>({ type: 'request-consent', tabId })
      .then((response) => {
        setConsentState(response?.hasConsent ? 'consented' : 'not-consented')
      })
      .catch(() => {
        setConsentState('not-consented')
      })

    // Get host for display
    browser.devtools.inspectedWindow
      .eval('document.location.hostname')
      .then(({ result, exceptionInfo }) => {
        if (typeof result === 'string' && !exceptionInfo?.isException) {
          setHost(result)
        }
      })
  }, [])

  const refreshConsent = useCallback(() => {
    const tabId = browser.devtools.inspectedWindow.tabId
    if (typeof tabId !== 'number') return
    browser.runtime
      .sendMessage<ConsentState>({ type: 'request-consent', tabId })
      .then((response) => {
        setConsentState(response?.hasConsent ? 'consented' : 'not-consented')
      })
      .catch(() => undefined)
  }, [])

  const tabId = browser.devtools.inspectedWindow.tabId
  const { handleStartLogging, handleAlwaysLog } = useConsentActions({
    tabId,
    host,
    onStateChanged: refreshConsent,
  })

  return { consentState, host, handleStartLogging, handleAlwaysLog }
}
