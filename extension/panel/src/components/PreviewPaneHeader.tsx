import { Globe, Terminal } from 'lucide-react'
import type React from 'react'
import { useDebouncedFilter } from '../../../shared/hooks/useDebouncedFilter'
import { buildStatsText } from '../../preview'
import { useFilteredData } from '../hooks/useFilteredData'
import { useActions, useSettings } from '../LoggyContext'
import { ActionButtons } from './controls/ActionButtons'
import { FilterControl } from './controls/FilterControl'
import { ExportOptionToggles } from './ExportOptionToggles'
import FilterToggle from './FilterToggle'
import { ServerConnection } from './ServerConnection'
import { StatsSummary } from './StatsSummary'
import Tabs from './Tabs'
import { TokenCountBadge } from './TokenCountBadge'

interface PreviewPaneHeaderProps {
  activeTab: 'preview' | 'routes'
  onTabChange: (tab: 'preview' | 'routes') => void
}

export default function PreviewPaneHeader({
  activeTab,
  onTabChange,
}: PreviewPaneHeaderProps): React.JSX.Element {
  const { filteredData, tokenEstimate } = useFilteredData()

  const {
    consoleFilter,
    networkFilter,
    consoleVisible,
    networkVisible,
    networkExportEnabled,
    filtersVisible,
  } = useSettings()

  const { setConsoleFilter, setNetworkFilter, toggleConsoleVisibility, toggleNetworkVisibility } =
    useActions()

  const { localValue: localConsoleFilter, handleChange: handleConsoleFilterChange } =
    useDebouncedFilter(consoleFilter, setConsoleFilter)

  const { localValue: localNetworkFilter, handleChange: handleNetworkFilterChange } =
    useDebouncedFilter(networkFilter, setNetworkFilter)

  return (
    <div className="px-4 py-2 bg-stone-100 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 shrink-0 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-4">
        <Tabs activeTab={activeTab} onTabChange={onTabChange} />
        <StatsSummary
          statsText={buildStatsText(filteredData)}
          consoleCount={filteredData.consoleLogs.length}
          networkCount={filteredData.networkEntries.length}
        />
        <TokenCountBadge tokenEstimate={tokenEstimate} />
      </div>

      <div className="flex items-center gap-4 flex-1 justify-end">
        {networkExportEnabled && <ServerConnection />}
        <ExportOptionToggles />
      </div>

      <div className="flex items-center gap-2">
        <ActionButtons />
        <FilterToggle />
      </div>

      {filtersVisible && (
        <div className="w-full flex items-center gap-4 pt-1 border-t border-stone-200 dark:border-stone-700 mt-1">
          <FilterControl
            id="console-filter"
            label="Console"
            icon={<Terminal size={14} aria-hidden="true" />}
            inputTestId="console-filter-input"
            toggleTestId="console-visibility-toggle"
            placeholder="Regex filter (e.g. error|warn)"
            value={localConsoleFilter}
            visible={consoleVisible}
            onChange={handleConsoleFilterChange}
            onToggleVisibility={toggleConsoleVisibility}
          />
          <FilterControl
            id="network-filter"
            label="Network"
            icon={<Globe size={14} aria-hidden="true" />}
            inputTestId="network-filter-input"
            toggleTestId="network-visibility-toggle"
            placeholder="String filter (use - prefix to exclude)"
            value={localNetworkFilter}
            visible={networkVisible}
            onChange={handleNetworkFilterChange}
            onToggleVisibility={toggleNetworkVisibility}
          />
        </div>
      )}
    </div>
  )
}
