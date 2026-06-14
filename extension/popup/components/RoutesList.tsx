import type React from 'react'

interface RoutesListProps {
  routeOptions: string[]
  selectedRoutes: string[]
  onToggleRoute: (route: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

/**
 * Presentational route filter for the popup.
 * Mirrors the panel's RoutesList but uses props for state and stays
 * compact (max-h-48 with overflow-auto) to fit the popup width.
 */
export function RoutesList({
  routeOptions,
  selectedRoutes,
  onToggleRoute,
  onSelectAll,
  onDeselectAll,
}: RoutesListProps): React.JSX.Element {
  const allSelected = routeOptions.length > 0 && selectedRoutes.length === routeOptions.length
  const noneSelected = selectedRoutes.length === 0

  return (
    <div
      data-testid='popup-routes-content'
      className='flex flex-col gap-2 max-h-48 overflow-auto bg-stone-50 dark:bg-stone-950 rounded p-2'
    >
      <p className='text-xs text-stone-500 dark:text-stone-400'>
        The text-based network filter above limits which routes appear.
      </p>

      <div className='flex gap-2'>
        <button
          type='button'
          onClick={onSelectAll}
          disabled={allSelected}
          className='text-xs px-2 py-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
        >
          Select All
        </button>
        <button
          type='button'
          onClick={onDeselectAll}
          disabled={noneSelected}
          className='text-xs px-2 py-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors'
        >
          Deselect All
        </button>
      </div>

      {routeOptions.map((route) => (
        <label
          key={route}
          className='flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer hover:text-stone-900 dark:hover:text-stone-100'
        >
          <input
            type='checkbox'
            checked={selectedRoutes.includes(route)}
            onChange={() => onToggleRoute(route)}
            className='w-3.5 h-3.5 rounded border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-stone-600 focus:ring-stone-500 focus:ring-offset-stone-50 dark:focus:ring-offset-stone-950'
          />
          <span className='font-mono truncate'>{route}</span>
        </label>
      ))}
    </div>
  )
}
