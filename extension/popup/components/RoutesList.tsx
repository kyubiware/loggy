import type React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { OptionCheckbox } from '../../shared/components/OptionCheckbox'
import { groupRoutesByPattern, type RouteGroup } from '../../utils/route-patterns'

interface RoutesListProps {
  routeOptions: string[]
  selectedRoutes: string[]
  onToggleRoute: (route: string) => void
  onToggleRoutes: (routes: string[], select: boolean) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  autoIncludeRoutes: boolean
  onToggleAutoIncludeRoutes: () => void
}

/**
 * Native HTML checkboxes can't express the `indeterminate` state through JSX
 * attributes — it must be set imperatively on the DOM element. This hook
 * returns a ref the call site can attach to the input so the effect can flip
 * the property after render. Keeping it as a hook (rather than a wrapper
 * component) lets the input stay nested directly inside the parent <label>,
 * which preserves the implicit label/control association.
 */
function useIndeterminateCheckbox(indeterminate: boolean): React.RefObject<HTMLInputElement | null> {
  const ref = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate
    }
  }, [indeterminate])
  return ref
}

function RouteGroupRow({
  group,
  selectedCount,
  onToggleRoutes,
}: {
  group: RouteGroup
  selectedCount: number
  onToggleRoutes: (routes: string[], select: boolean) => void
}): React.JSX.Element {
  const allSelected = selectedCount === group.routes.length
  const noneSelected = selectedCount === 0
  const indeterminate = !allSelected && !noneSelected
  const checkboxRef = useIndeterminateCheckbox(indeterminate)
  return (
    <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer hover:text-stone-900 dark:hover:text-stone-100">
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={allSelected}
        onChange={() => onToggleRoutes(group.routes, !allSelected)}
        className="w-3.5 h-3.5 rounded border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-600 focus:ring-stone-500 focus:ring-offset-stone-50 dark:focus:ring-offset-stone-950"
      />
      <span className="font-mono truncate" title={group.pattern}>
        {group.pattern}
      </span>
      {group.routes.length > 1 && (
        <span
          className="text-xs px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300 shrink-0"
          title={`${group.routes.length} concrete routes collapse to this pattern`}
        >
          ({group.routes.length})
        </span>
      )}
    </label>
  )
}

/**
 * Presentational route filter for the popup.
 * Mirrors the panel's RoutesList but uses props for state and stays
 * compact (max-h-48 with overflow-auto) to fit the popup width.
 */
export function RoutesList({
  routeOptions,
  selectedRoutes,
  onToggleRoutes,
  onSelectAll,
  onDeselectAll,
  autoIncludeRoutes,
  onToggleAutoIncludeRoutes,
}: RoutesListProps): React.JSX.Element {
  const allSelected = routeOptions.length > 0 && selectedRoutes.length === routeOptions.length
  const noneSelected = selectedRoutes.length === 0

  const selectedSet = useMemo(() => new Set(selectedRoutes), [selectedRoutes])
  const groups = useMemo(() => groupRoutesByPattern(routeOptions), [routeOptions])

  return (
    <div
      data-testid="popup-routes-content"
      className="flex flex-col gap-2 max-h-48 overflow-auto bg-stone-50 dark:bg-stone-950 rounded p-2"
    >
      <p className="text-xs text-stone-500 dark:text-stone-400">
        The text-based network filter above limits which routes appear.
      </p>

      <div className="flex flex-col gap-2 pb-2 border-b border-stone-200 dark:border-stone-700">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={allSelected}
            className="text-xs px-2 py-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            disabled={noneSelected}
            className="text-xs px-2 py-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Deselect All
          </button>
        </div>
        <OptionCheckbox
          testId="popup-auto-include-routes"
          label="Auto-include new routes"
          checked={autoIncludeRoutes}
          onChange={onToggleAutoIncludeRoutes}
        />
      </div>

      {groups.map((group) => {
        const selectedCount = group.routes.reduce(
          (count, route) => (selectedSet.has(route) ? count + 1 : count),
          0
        )
        return (
          <RouteGroupRow
            key={group.pattern}
            group={group}
            selectedCount={selectedCount}
            onToggleRoutes={onToggleRoutes}
          />
        )
      })}
    </div>
  )
}
