import { useEffect, useRef } from 'react'
import { browser } from '../../../browser-apis/index.js'
import type { ConsoleMessage } from '../../../types/console'
import type { HAREntry } from '../../../types/har'
import type { LoggyState } from '../../../types/state'
import { debugLog } from '../../../utils/debug-logger'
import {
  clearResponseBodies,
  notifyPanelClosed,
  notifyPanelOpened,
  startResponseBodyCapture,
  stopResponseBodyCapture,
} from '../../capture'
import type { Action } from './useCaptureData'

function handleNavigated(
  url: string,
  previousUrlRef: React.MutableRefObject<string>,
  dispatch: React.Dispatch<Action>,
  latestStateRef: React.MutableRefObject<LoggyState>,
  preservedConsoleLogsRef: React.MutableRefObject<ConsoleMessage[]>,
  networkClearCutoffMs: React.MutableRefObject<number | null>
): void {
  // Navigation = URL changed. Refresh = same URL.
  // Navigation should ALWAYS preserve logs; refresh is controlled by preserveLogs.
  const isNavigation = previousUrlRef.current !== '' && url !== previousUrlRef.current
  previousUrlRef.current = url

  debugLog(
    'lifecycle',
    'panel',
    `onNavigated fired: ${isNavigation ? 'navigation' : 'refresh'} preserveLogs=${latestStateRef.current.preserveLogs}`,
    {
      url,
      previousUrl: previousUrlRef.current,
      consoleLogCount: latestStateRef.current.consoleLogs.length,
      networkEntryCount: latestStateRef.current.networkEntries.length,
      existingPreservedCount: preservedConsoleLogsRef.current.length,
      networkClearCutoffMs: networkClearCutoffMs.current,
    }
  )

  if (isNavigation) {
    // Navigation → ALWAYS preserve console logs across the page change.
    preservedConsoleLogsRef.current = latestStateRef.current.consoleLogs
    networkClearCutoffMs.current = null
    debugLog(
      'lifecycle',
      'panel',
      `onNavigated: NAVIGATION — preserving ${preservedConsoleLogsRef.current.length} console logs`
    )
    return
  }

  // Refresh → respect preserveLogs setting.
  const preserveLogs = latestStateRef.current.preserveLogs
  if (preserveLogs) {
    preservedConsoleLogsRef.current = latestStateRef.current.consoleLogs
    networkClearCutoffMs.current = null
    debugLog(
      'lifecycle',
      'panel',
      `onNavigated: REFRESH — PRESERVING ${preservedConsoleLogsRef.current.length} console logs (preserveLogs=true)`
    )
    return
  }

  debugLog('lifecycle', 'panel', 'onNavigated: REFRESH — CLEARING data (preserveLogs=false)')
  dispatch({ type: 'RESET_DATA' })
  networkClearCutoffMs.current = null
  clearResponseBodies()
}

function isAfterCutoff(entry: HAREntry, cutoffMs: number | null): boolean {
  if (cutoffMs === null) return true
  const entryTimeMs = Date.parse(entry.startedDateTime)
  if (Number.isNaN(entryTimeMs)) return false
  return entryTimeMs > cutoffMs
}

export { isAfterCutoff }

export function useLifecycleEffect(
  captureData: () => Promise<void>,
  startAutoRefresh: () => void,
  stopAutoRefresh: () => void,
  dispatch: React.Dispatch<Action>,
  latestStateRef: React.MutableRefObject<LoggyState>,
  preservedConsoleLogsRef: React.MutableRefObject<ConsoleMessage[]>,
  networkClearCutoffMs: React.MutableRefObject<number | null>
): void {
  const previousUrlRef = useRef('')
  useEffect(() => {
    startResponseBodyCapture()
    const inspectedTabId = chrome.devtools.inspectedWindow.tabId
    if (typeof inspectedTabId === 'number') notifyPanelOpened(inspectedTabId)
    void captureData()
    if (document.visibilityState === 'visible') startAutoRefresh()

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        startAutoRefresh()
        void captureData()
        return
      }
      stopAutoRefresh()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const onNavigated = (url: string): void => {
      handleNavigated(
        url,
        previousUrlRef,
        dispatch,
        latestStateRef,
        preservedConsoleLogsRef,
        networkClearCutoffMs
      )
    }
    browser.devtools.network.onNavigated.addListener(onNavigated)

    return () => {
      if (typeof inspectedTabId === 'number') notifyPanelClosed(inspectedTabId)
      stopAutoRefresh()
      stopResponseBodyCapture()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      browser.devtools.network.onNavigated.removeListener(onNavigated)
    }
  }, [
    captureData,
    startAutoRefresh,
    stopAutoRefresh,
    dispatch,
    latestStateRef,
    preservedConsoleLogsRef,
    networkClearCutoffMs,
  ])
}
