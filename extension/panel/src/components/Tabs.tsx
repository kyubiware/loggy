import { MonitorPlay, Route } from 'lucide-react'
import type React from 'react'
import { Tooltip } from '../../../shared/components/Tooltip'
import TabButton from './TabButton'

type Tab = 'preview' | 'routes'

interface TabsProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

export default function Tabs({ activeTab, onTabChange }: TabsProps): React.JSX.Element {
  return (
    <div className="flex bg-stone-200 dark:bg-stone-700 p-0.5 rounded gap-0.5">
      <Tooltip content="Preview">
        <TabButton
          active={activeTab === 'preview'}
          onClick={() => onTabChange('preview')}
          data-testid="tab-preview"
          aria-label="Preview"
        >
          <MonitorPlay size={16} aria-hidden="true" />
        </TabButton>
      </Tooltip>
      <Tooltip content="Routes">
        <TabButton
          active={activeTab === 'routes'}
          onClick={() => onTabChange('routes')}
          data-testid="tab-routes"
          aria-label="Routes"
        >
          <Route size={16} aria-hidden="true" />
        </TabButton>
      </Tooltip>
    </div>
  )
}
