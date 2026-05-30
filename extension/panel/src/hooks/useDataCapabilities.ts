import { useCallback, useRef } from 'react'
import type { LoggyState } from '../../../types/state'
import { useCaptureActions } from './useCaptureActions'
import type { Action } from './useCaptureData'
import { useLifecycleEffect } from './useLifecycle'
import { useHydrationEffect, usePersistenceEffect } from './usePersistence'

const AUTO_REFRESH_INTERVAL_MS = 2000

function useAutoRefresh(captureData: () => Promise<void>): {
  startAutoRefresh: () => void
  stopAutoRefresh: () => void
} {
  const autoRefreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const startAutoRefresh = useCallback((): void => {
    if (autoRefreshTimer.current !== null) return
    autoRefreshTimer.current = setInterval(() => {
      void captureData()
    }, AUTO_REFRESH_INTERVAL_MS)
  }, [captureData])
  const stopAutoRefresh = useCallback((): void => {
    if (autoRefreshTimer.current === null) return
    clearInterval(autoRefreshTimer.current)
    autoRefreshTimer.current = null
  }, [])
  return { startAutoRefresh, stopAutoRefresh }
}

/**
 * Manages data capture, persistence, and panel lifecycle for the Loggy panel.
 */
export function useDataCapabilities(
  dispatch: React.Dispatch<Action>,
  state: LoggyState,
  probeConfiguredServer: (configuredServerUrl: string) => Promise<void>,
  hydrationCompleteRef: React.MutableRefObject<boolean>,
  markUrlProbed: (url: string) => void
): {
  captureData: () => Promise<void>
  clearData: () => Promise<void>
  latestStateRef: React.MutableRefObject<LoggyState>
} {
  const { captureData, clearData, latestStateRef, preservedConsoleLogsRef, networkClearCutoffMs } =
    useCaptureActions(dispatch, state)
  const { startAutoRefresh, stopAutoRefresh } = useAutoRefresh(captureData)
  useHydrationEffect(dispatch, hydrationCompleteRef, probeConfiguredServer, markUrlProbed)
  usePersistenceEffect(state, hydrationCompleteRef)
  useLifecycleEffect(
    captureData,
    startAutoRefresh,
    stopAutoRefresh,
    dispatch,
    latestStateRef,
    preservedConsoleLogsRef,
    networkClearCutoffMs
  )
  return { captureData, clearData, latestStateRef }
}
