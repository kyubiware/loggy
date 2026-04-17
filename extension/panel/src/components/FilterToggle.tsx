import { Settings } from 'lucide-react'
import type React from 'react'
import { IconButtonToggle } from '../../../shared/components/IconButtonToggle'
import { useActions, useSettings } from '../LoggyContext'

export default function FilterToggle(): React.JSX.Element {
  const { filtersVisible } = useSettings()
  const { toggleFiltersVisible } = useActions()

  return (
    <IconButtonToggle
      icon={<Settings className="h-3.5 w-3.5" aria-hidden="true" />}
      label={filtersVisible ? 'Hide filters' : 'Show filters'}
      pressed={filtersVisible}
      onToggle={toggleFiltersVisible}
      testId="filters-panel-toggle"
    />
  )
}
