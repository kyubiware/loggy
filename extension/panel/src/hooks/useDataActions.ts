import type { Dispatch, RefObject } from 'react'
import { useCallback, useMemo } from 'react'
import type { LoggyState } from '../../../types/state'
import { clearAction, copyAction } from '../actions'
import type { Action } from './useCaptureData'

interface UseDataActionsParams {
  dispatch: Dispatch<Action>
  captureData: (() => Promise<void>) | undefined
  clearData: () => Promise<void>
  showToastRef: RefObject<(message: string, type: 'success' | 'error') => void>
  stateRef: RefObject<LoggyState>
  selectedRoutesRef: RefObject<string[]>
}

export function useDataActions({
  dispatch,
  captureData,
  clearData,
  showToastRef,
  stateRef,
  selectedRoutesRef,
}: UseDataActionsParams) {
  const refresh = useCallback(async () => {
    dispatch({ type: 'SET_DATA', consoleLogs: [], networkEntries: [] })
    if (captureData) await captureData()
  }, [captureData, dispatch])

  const clearAll = useCallback(() => {
    const showToast = showToastRef.current
    if (!showToast) return Promise.resolve()
    return clearAction(clearData, showToast)
  }, [clearData, showToastRef])

  const copy = useCallback(() => {
    const showToast = showToastRef.current
    if (!showToast) return Promise.resolve()
    const currentState = stateRef.current
    const currentRoutes = selectedRoutesRef.current
    if (!currentState || !currentRoutes) return Promise.resolve()
    return copyAction({ ...currentState, selectedRoutes: currentRoutes } as LoggyState, showToast)
  }, [selectedRoutesRef, showToastRef, stateRef])

  return useMemo(() => ({ refresh, clearAll, copy }), [refresh, clearAll, copy])
}
