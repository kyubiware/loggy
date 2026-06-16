import type { Dispatch, SetStateAction } from 'react'
import { useCallback, useEffect, useMemo, useRef } from 'react'

interface UseRouteActionsParams {
  setSelectedRoutes: Dispatch<SetStateAction<string[]>>
  routeOptions: string[]
  autoIncludeRoutes: boolean
}

export function useRouteActions({
  setSelectedRoutes,
  routeOptions,
  autoIncludeRoutes,
}: UseRouteActionsParams) {
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

  const toggleRoutes = useCallback(
    (routes: string[], select: boolean) => {
      const targets = new Set(routes)
      setSelectedRoutes((previous) => {
        if (select) {
          const additions = routes.filter((route) => !previous.includes(route))
          if (additions.length === 0) return previous
          return [...previous, ...additions]
        }
        const filtered = previous.filter((route) => !targets.has(route))
        if (filtered.length === previous.length) return previous
        return filtered
      })
    },
    [setSelectedRoutes]
  )

  const routeOptionsKey = routeOptions.join(',')
  const routeOptionsRef = useRef(routeOptions)
  routeOptionsRef.current = routeOptions

  // biome-ignore lint: routeOptionsKey intentionally triggers this effect on content change while using ref to avoid stale closures
  useEffect(() => {
    const currentRouteOptions = routeOptionsRef.current
    setSelectedRoutes((previous) => {
      const staleRemoved = previous.filter((route) => currentRouteOptions.includes(route))
      if (!autoIncludeRoutes) {
        // Only prune stale routes; never auto-add new ones
        return staleRemoved.length === previous.length ? previous : staleRemoved
      }
      const newRoutes = currentRouteOptions.filter((route) => !previous.includes(route))
      const next = [...staleRemoved, ...newRoutes]
      return next.length === previous.length && newRoutes.length === 0 ? previous : next
    })
  }, [routeOptionsKey, autoIncludeRoutes, setSelectedRoutes])

  return useMemo(
    () => ({ toggleRoute, selectAllRoutes, deselectAllRoutes, toggleRoutes }),
    [toggleRoute, selectAllRoutes, deselectAllRoutes, toggleRoutes]
  )
}
