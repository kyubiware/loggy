import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

interface UseRouteActionsParams {
  setSelectedRoutes: Dispatch<SetStateAction<string[]>>
  routeOptions: string[]
}

export function useRouteActions({ setSelectedRoutes, routeOptions }: UseRouteActionsParams) {
  const toggleRoute = useCallback(
    (route: string) => {
      setSelectedRoutes((previous) =>
        previous.includes(route)
          ? previous.filter((selectedRoute) => selectedRoute !== route)
          : [...previous, route]
      )
    },
    [setSelectedRoutes]
  )

  const selectAllRoutes = useCallback(() => {
    setSelectedRoutes(routeOptions)
  }, [routeOptions, setSelectedRoutes])

  const deselectAllRoutes = useCallback(() => {
    setSelectedRoutes([])
  }, [setSelectedRoutes])

  const routeOptionsKey = routeOptions.join(',')
  const routeOptionsRef = useRef(routeOptions)
  routeOptionsRef.current = routeOptions

  // biome-ignore lint: routeOptionsKey intentionally triggers this effect on content change while using ref to avoid stale closures
  useEffect(() => {
    const currentRouteOptions = routeOptionsRef.current
    setSelectedRoutes((previous) => {
      const staleRemoved = previous.filter((route) => currentRouteOptions.includes(route))
      const newRoutes = currentRouteOptions.filter((route) => !previous.includes(route))
      const next = [...staleRemoved, ...newRoutes]
      return next.length === previous.length && newRoutes.length === 0 ? previous : next
    })
  }, [routeOptionsKey, setSelectedRoutes])

  return useMemo(
    () => ({ toggleRoute, selectAllRoutes, deselectAllRoutes }),
    [toggleRoute, selectAllRoutes, deselectAllRoutes]
  )
}
