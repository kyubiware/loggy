import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useMemo } from 'react'
import type { Action } from './useCaptureData'

interface UseFilterActionsParams {
  dispatch: Dispatch<Action>
  setFiltersVisible: Dispatch<SetStateAction<boolean>>
}

export function useFilterActions({ dispatch, setFiltersVisible }: UseFilterActionsParams) {
  const setConsoleFilter = useCallback(
    (value: string) => {
      dispatch({ type: 'UPDATE_FILTER', field: 'consoleFilter', value })
    },
    [dispatch]
  )

  const setNetworkFilter = useCallback(
    (value: string) => {
      dispatch({ type: 'UPDATE_FILTER', field: 'networkFilter', value })
    },
    [dispatch]
  )

  const toggleConsoleVisibility = useCallback(() => {
    dispatch({ type: 'TOGGLE_VISIBILITY', field: 'consoleVisible' })
  }, [dispatch])

  const toggleNetworkVisibility = useCallback(() => {
    dispatch({ type: 'TOGGLE_VISIBILITY', field: 'networkVisible' })
  }, [dispatch])

  const toggleFiltersVisible = useCallback(() => {
    setFiltersVisible((prev) => !prev)
  }, [setFiltersVisible])

  return useMemo(
    () => ({
      setConsoleFilter,
      setNetworkFilter,
      toggleConsoleVisibility,
      toggleNetworkVisibility,
      toggleFiltersVisible,
    }),
    [
      setConsoleFilter,
      setNetworkFilter,
      toggleConsoleVisibility,
      toggleNetworkVisibility,
      toggleFiltersVisible,
    ]
  )
}
