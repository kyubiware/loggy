import { useCallback, useRef } from 'react'
import { browser } from '../../../browser-apis/index.js'
import type { ConsoleMessage } from '../../../types/console'
import type { HAREntry } from '../../../types/har'
import type { LoggyState } from '../../../types/state'
import { debugLog } from '../../../utils/debug-logger'
import {
  captureConsoleLogs,
  captureNetworkEntries,
  clearCapturedConsoleLogs,
  enrichWithResponseBodies,
} from '../../capture'
import { panelDataFingerprint, syncPanelDataToBackground } from '../../sync-to-background'
import type { Action } from './useCaptureData'
import { isAfterCutoff } from './useLifecycle'

/**
 * Syncs the panel's captured data to background storage when it changes, so
 * the popup (which reads exclusively from storage) can see logs captured in
 * devtools mode. No-op when the fingerprint is unchanged or the tabId is unset.
 */
function syncCapturedToBackground(
  lastSyncFingerprintRef: React.MutableRefObject<string>,
  consoleLogs: ConsoleMessage[],
  networkEntries: HAREntry[]
): void {
  const fingerprint = panelDataFingerprint(consoleLogs, networkEntries)
  if (fingerprint === lastSyncFingerprintRef.current) {
    return
  }
  lastSyncFingerprintRef.current = fingerprint
  const tabId = browser.devtools.inspectedWindow.tabId
  if (typeof tabId === 'number') {
    syncPanelDataToBackground(tabId, consoleLogs, networkEntries)
  }
}

export function useCaptureActions(
  dispatch: React.Dispatch<Action>,
  state: LoggyState
): {
  captureData: () => Promise<void>
  clearData: () => Promise<void>
  latestStateRef: React.MutableRefObject<LoggyState>
  preservedConsoleLogsRef: React.MutableRefObject<ConsoleMessage[]>
  networkClearCutoffMs: React.MutableRefObject<number | null>
} {
  const isCapturing = useRef(false)
  const networkClearCutoffMs = useRef<number | null>(null)
  const preservedConsoleLogsRef = useRef<ConsoleMessage[]>([])
  const latestStateRef = useRef(state)
  const lastSyncFingerprintRef = useRef('')
  const filterAfter = useCallback(
    (entries: HAREntry[]): HAREntry[] =>
      entries.filter((e) => isAfterCutoff(e, networkClearCutoffMs.current)),
    []
  )
  const captureData = useCallback(async (): Promise<void> => {
    if (isCapturing.current) return
    isCapturing.current = true
    try {
      const rawEntries = await captureNetworkEntries()
      const networkEntries = enrichWithResponseBodies(filterAfter(rawEntries))
      let consoleLogs = await captureConsoleLogs()
      debugLog('capture', 'panel', `captureData: raw capture complete`, {
        capturedConsoleLogs: consoleLogs.length,
        capturedNetworkEntries: networkEntries.length,
        rawNetworkEntries: rawEntries.length,
        networkClearCutoffMs: networkClearCutoffMs.current,
        pendingPreservedCount: preservedConsoleLogsRef.current.length,
        preserveLogs: latestStateRef.current.preserveLogs,
      })
      if (preservedConsoleLogsRef.current.length > 0) {
        const prevCount = consoleLogs.length
        consoleLogs = [...preservedConsoleLogsRef.current, ...consoleLogs]
        debugLog('capture', 'panel', `captureData: MERGED preserved logs`, {
          preservedCount: preservedConsoleLogsRef.current.length,
          newCount: prevCount,
          totalCount: consoleLogs.length,
        })
        preservedConsoleLogsRef.current = []
      }
      dispatch({ type: 'SET_DATA', consoleLogs, networkEntries })

      // Mirror the panel's view into background storage so the popup can see
      // logs captured in devtools mode (no-op when data hasn't changed).
      syncCapturedToBackground(lastSyncFingerprintRef, consoleLogs, networkEntries)
    } catch (error) {
      console.error('Error capturing data:', error)
    } finally {
      isCapturing.current = false
    }
  }, [filterAfter, dispatch])
  const clearData = useCallback(async (): Promise<void> => {
    debugLog('lifecycle', 'panel', 'clearData: manual clear requested', {
      consoleLogCount: latestStateRef.current.consoleLogs.length,
      networkEntryCount: latestStateRef.current.networkEntries.length,
      preserveLogs: latestStateRef.current.preserveLogs,
    })
    dispatch({ type: 'RESET_DATA' })
    networkClearCutoffMs.current = Date.now()
    await clearCapturedConsoleLogs()
  }, [dispatch])
  return { captureData, clearData, latestStateRef, preservedConsoleLogsRef, networkClearCutoffMs }
}
