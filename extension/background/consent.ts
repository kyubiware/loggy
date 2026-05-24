declare const __BROWSER__: string

import { getOrCreateTabState } from './tab-state'
import { isHostInAlwaysLogList } from './storage'
import { isLocalPage } from '../utils/is-local-page'
import { debugLog } from '../utils/debug-logger'
import type { ConsentState, CaptureMode } from '../types/messages'

export async function evaluateConsent(tabId: number, url: string): Promise<ConsentState> {
  if (isLocalPage(url)) {
    debugLog('capture', 'background', 'Consent: local page auto-granted', { tabId })
    return { hasConsent: true, captureMode: 'content-script', reason: 'local-page' }
  }

  try {
    const parsedUrl = new URL(url)
    const host = parsedUrl.hostname

    if (await isHostInAlwaysLogList(host)) {
      const mode: CaptureMode = __BROWSER__ === 'chrome' ? 'debugger' : 'content-script'
      debugLog('capture', 'background', 'Consent: always-log host', { tabId, host, captureMode: mode })
      return { hasConsent: true, captureMode: mode, reason: 'always-log' }
    }
  } catch {
    // Invalid URL — no consent
  }

  const current = getOrCreateTabState(tabId)
  if (current.mode !== 'inactive') {
    debugLog('capture', 'background', 'Consent: per-session active', { tabId, mode: current.mode })
    return { hasConsent: true, captureMode: current.mode, reason: 'per-session' }
  }

  debugLog('capture', 'background', 'Consent: denied', { tabId })
  return { hasConsent: false, captureMode: 'none', reason: 'no-consent' }
}
