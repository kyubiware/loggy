import { useEffect, useRef } from 'react'
import { buildExportMarkdown } from '../../../shared/export'
import { pushToServer } from '../../../shared/server-export'
import type { ConsoleMessage } from '../../../types/console'
import type { HAREntry } from '../../../types/har'
import type { LoggyState } from '../../../types/state'
import { debugLog } from '../../../utils/debug-logger'
import type { Action } from './useCaptureData'
import { buildExportFingerprint } from './useCaptureData'

async function syncPush(
  dispatch: React.Dispatch<Action>,
  url: string,
  markdown: string
): Promise<void> {
  try {
    const success = await pushToServer(url, markdown)
    debugLog('message', 'panel', `Auto-sync debounce: pushToServer result=${success}`, { url })
    dispatch({ type: 'SET_SERVER_SYNC_ERROR', value: !success })
  } catch (err) {
    debugLog('message', 'panel', `Auto-sync debounce: ERROR ${String(err)}`, {
      error: String(err),
    })
  }
}

async function performDataChangeSync(
  latestStateRef: React.MutableRefObject<LoggyState>,
  lastExportFingerprintRef: React.MutableRefObject<string | null>,
  dispatch: React.Dispatch<Action>,
  scheduledConsoleLogs: ConsoleMessage[],
  scheduledNetworkEntries: HAREntry[]
): Promise<void> {
  const latestState = latestStateRef.current

  if (
    latestState.consoleLogs !== scheduledConsoleLogs ||
    latestState.networkEntries !== scheduledNetworkEntries
  ) {
    debugLog(
      'message',
      'panel',
      'Auto-sync effect #1 debounce: data changed during debounce, skipping'
    )
    return
  }

  const markdown = await buildExportMarkdown(latestState)
  const fingerprint = buildExportFingerprint(latestState)

  if (fingerprint === lastExportFingerprintRef.current) {
    debugLog('message', 'panel', 'Auto-sync effect #1 debounce: fingerprint unchanged, skipping')
    return
  }

  lastExportFingerprintRef.current = fingerprint
  await syncPush(dispatch, latestState.serverUrl, markdown)
}

async function performOptionChangeSync(
  latestStateRef: React.MutableRefObject<LoggyState>,
  lastExportFingerprintRef: React.MutableRefObject<string | null>,
  dispatch: React.Dispatch<Action>
): Promise<void> {
  const latestState = latestStateRef.current
  const fingerprint = buildExportFingerprint(latestState)

  if (fingerprint === lastExportFingerprintRef.current) {
    debugLog('message', 'panel', 'Auto-sync effect #2 debounce: fingerprint unchanged, skipping')
    return
  }

  lastExportFingerprintRef.current = fingerprint
  const markdown = await buildExportMarkdown(latestState)
  await syncPush(dispatch, latestState.serverUrl, markdown)
}

function useLatestStateSync(
  state: LoggyState,
  latestStateRef: React.MutableRefObject<LoggyState>
): void {
  useEffect(() => {
    latestStateRef.current = state
  }, [state, latestStateRef])
}

function useDataChangeSync(
  state: LoggyState,
  dispatch: React.Dispatch<Action>,
  latestStateRef: React.MutableRefObject<LoggyState>,
  lastExportFingerprintRef: React.MutableRefObject<string | null>,
  autoSyncTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
): void {
  useEffect(() => {
    const scheduledConsoleLogs = state.consoleLogs
    const scheduledNetworkEntries = state.networkEntries

    debugLog(
      'message',
      'panel',
      `Auto-sync effect #1 fired: autoServerSync=${state.autoServerSync}, serverConnected=${state.serverConnected}, logs=${scheduledConsoleLogs.length}, nets=${scheduledNetworkEntries.length}`
    )

    if (autoSyncTimeoutRef.current) {
      clearTimeout(autoSyncTimeoutRef.current)
      autoSyncTimeoutRef.current = null
    }

    if (!state.autoServerSync || !state.serverConnected) {
      debugLog(
        'message',
        'panel',
        `Auto-sync effect #1 SKIPPED: autoServerSync=${state.autoServerSync}, serverConnected=${state.serverConnected}`
      )
      return
    }

    autoSyncTimeoutRef.current = setTimeout(() => {
      void performDataChangeSync(
        latestStateRef,
        lastExportFingerprintRef,
        dispatch,
        scheduledConsoleLogs,
        scheduledNetworkEntries
      )
    }, 1500)

    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current)
        autoSyncTimeoutRef.current = null
      }
    }
  }, [
    state.autoServerSync,
    state.serverConnected,
    state.consoleLogs,
    state.networkEntries,
    autoSyncTimeoutRef,
    dispatch,
    latestStateRef,
    lastExportFingerprintRef,
  ])
}

function useOptionChangeSync(
  state: LoggyState,
  dispatch: React.Dispatch<Action>,
  latestStateRef: React.MutableRefObject<LoggyState>,
  lastExportFingerprintRef: React.MutableRefObject<string | null>,
  autoSyncTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
): void {
  useEffect(() => {
    debugLog(
      'message',
      'panel',
      `Auto-sync effect #2 fired: autoServerSync=${state.autoServerSync}, serverConnected=${state.serverConnected}, logsLen=${state.consoleLogs.length}, netsLen=${state.networkEntries.length}`
    )

    if (!state.autoServerSync || !state.serverConnected) {
      debugLog(
        'message',
        'panel',
        `Auto-sync effect #2 SKIPPED: autoServerSync=${state.autoServerSync}, serverConnected=${state.serverConnected}`
      )
      return
    }

    if (state.consoleLogs.length === 0 && state.networkEntries.length === 0) {
      debugLog('message', 'panel', 'Auto-sync effect #2 skipped: no data')
      return
    }

    if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current)

    autoSyncTimeoutRef.current = setTimeout(() => {
      void performOptionChangeSync(latestStateRef, lastExportFingerprintRef, dispatch)
    }, 500)

    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current)
        autoSyncTimeoutRef.current = null
      }
    }
  }, [
    state.autoServerSync,
    state.serverConnected,
    state.consoleLogs.length,
    state.networkEntries.length,
    autoSyncTimeoutRef,
    dispatch,
    latestStateRef,
    lastExportFingerprintRef,
  ])
}

/**
 * Handles auto-sync to the configured server when data or options change.
 * Manages debounced push-to-server effects triggered by data and settings changes.
 */
export function useAutoSync(
  state: LoggyState,
  dispatch: React.Dispatch<Action>,
  latestStateRef: React.MutableRefObject<LoggyState>
): void {
  const autoSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastExportFingerprintRef = useRef<string | null>(null)

  useLatestStateSync(state, latestStateRef)
  useDataChangeSync(state, dispatch, latestStateRef, lastExportFingerprintRef, autoSyncTimeoutRef)
  useOptionChangeSync(state, dispatch, latestStateRef, lastExportFingerprintRef, autoSyncTimeoutRef)
}
