import type React from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { OptionCheckbox } from '../../../shared/components/OptionCheckbox'
import { groupRoutesByPattern, type RouteGroup } from '../../../utils/route-patterns'
import { useActions, useLogData, useSettings } from '../LoggyContext'

/**
 * Native HTML checkboxes can't express the `indeterminate` state through JSX
 * attributes — it must be set imperatively on the DOM element. This hook
 * returns a ref the call site can attach to the input so the effect can flip
 * the property after render. Keeping it as a hook (rather than a wrapper
 * component) lets the input stay nested directly inside the parent <label>,
 * which preserves the implicit label/control association.
 */
function useIndeterminateCheckbox(
  indeterminate: boolean
): React.RefObject<HTMLInputElement | null> {
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
    <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300 cursor-pointer hover:text-stone-900 dark:hover:text-stone-100">
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={allSelected}
        onChange={() => onToggleRoutes(group.routes, !allSelected)}
        className="w-4 h-4 rounded border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-600 focus:ring-stone-500 focus:ring-offset-stone-50 dark:focus:ring-offset-stone-950"
      />
      <span className="font-mono text-xs truncate" title={group.pattern}>
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

export default function RoutesList(): React.JSX.Element {
  const { routeOptions, selectedRoutes } = useLogData()
  const { toggleRoutes, selectAllRoutes, deselectAllRoutes, toggleSetting } = useActions()
  const { autoIncludeRoutes } = useSettings()

  const selectedSet = useMemo(() => new Set(selectedRoutes), [selectedRoutes])
  const groups = useMemo(() => groupRoutesByPattern(routeOptions), [routeOptions])

  const allSelected = routeOptions.length > 0 && selectedRoutes.length === routeOptions.length
  const noneSelected = selectedRoutes.length === 0

  return (
    <div
      data-testid="routes-content"
      className="flex-1 overflow-auto p-4 bg-stone-50 dark:bg-stone-950"
    >
      <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">
        The text-based network filter above limits which routes appear.
      </p>

      {routeOptions.length === 0 ? (
        <div className="text-sm text-stone-500 dark:text-stone-400">No routes available</div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 pb-2 border-b border-stone-200 dark:border-stone-700">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllRoutes}
                disabled={allSelected}
                className="text-xs px-2 py-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={deselectAllRoutes}
                disabled={noneSelected}
                className="text-xs px-2 py-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Deselect All
              </button>
            </div>
            <OptionCheckbox
              testId="panel-auto-include-routes"
              label="Auto-include new routes"
              checked={autoIncludeRoutes}
              onChange={() => toggleSetting('autoIncludeRoutes')}
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
                onToggleRoutes={toggleRoutes}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
