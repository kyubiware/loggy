import type React from 'react'
import { useState } from 'react'
import PreviewContent from './PreviewContent'
import PreviewPaneHeader from './PreviewPaneHeader'
import RoutesList from './RoutesList'

export default function PreviewPane(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'preview' | 'routes'>('preview')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PreviewPaneHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <PreviewContent visible={activeTab === 'preview'} />

      {activeTab === 'routes' && <RoutesList />}
    </div>
  )
}
