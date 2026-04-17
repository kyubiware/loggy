import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'
import { filterByRoutes, filterConsole, filterNetwork, getRouteOptions } from '../utils/filters.js'
import type { LoggyState } from './state.js'

/**
 * Filtered data ready for display in the panel.
 * Contains console logs and network entries after applying all filters.
 */
export interface FilteredPanelData {
  /** Console logs after filter and visibility rules are applied */
  consoleLogs: ConsoleMessage[]
  /** Network entries after filter, visibility, and route selection rules are applied */
  networkEntries: HAREntry[]
  /** Available route options extracted from filtered network entries */
  routeOptions: string[]
}

/**
 * Applies all filters to the panel state and returns filtered data for display.
 * Filters console logs by pattern, network entries by pattern and selected routes.
 * @param state - The current Loggy panel state containing filters and data
 * @returns Filtered data with console logs, network entries, and route options
 */
export function getFilteredPanelData(state: LoggyState): FilteredPanelData {
  const textFilteredNetworkEntries = state.networkVisible
    ? filterNetwork(state.networkEntries, state.networkFilter)
    : []
  const routeOptions = getRouteOptions(textFilteredNetworkEntries)
  const validSelectedRoutes = state.selectedRoutes.filter((route) => routeOptions.includes(route))

  return {
    consoleLogs: state.consoleVisible ? filterConsole(state.consoleLogs, state.consoleFilter) : [],
    networkEntries: filterByRoutes(textFilteredNetworkEntries, validSelectedRoutes),
    routeOptions,
  }
}
