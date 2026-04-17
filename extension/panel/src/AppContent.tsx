import type React from 'react'
import PreviewPane from './components/PreviewPane'
import Toast from './components/Toast'
import { useSettings } from './LoggyContext'

export function AppContent(): React.JSX.Element {
  const { toastState } = useSettings()

  return (
    <div
      id="loggy-app"
      className="min-h-screen bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 flex flex-col h-screen overflow-hidden"
    >
      <PreviewPane />

      <Toast message={toastState.message} type={toastState.type} visible={toastState.visible} />
    </div>
  )
}
