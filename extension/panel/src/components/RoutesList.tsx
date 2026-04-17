import type React from 'react'
import { useActions, useLogData } from '../LoggyContext'

export default function RoutesList(): React.JSX.Element {
  const { routeOptions, selectedRoutes } = useLogData()
  const { toggleRoute, selectAllRoutes, deselectAllRoutes } = useActions()

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
          <div className="flex gap-2 mb-2">
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
          {routeOptions.map((route) => (
            <label
              key={route}
              className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300 cursor-pointer hover:text-stone-900 dark:hover:text-stone-100"
            >
              <input
                type="checkbox"
                checked={selectedRoutes.includes(route)}
                onChange={() => toggleRoute(route)}
                className="w-4 h-4 rounded border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-600 focus:ring-stone-500 focus:ring-offset-stone-50 dark:focus:ring-offset-stone-950"
              />
              <span className="font-mono text-xs truncate">{route}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
