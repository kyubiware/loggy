import type React from 'react'
import { AppContent } from './AppContent'
import { ConsentView } from './components/ConsentView'
import { useConsentCheck } from './hooks/useConsentCheck'
import { LoggyProvider } from './LoggyContext'

export default function App(): React.JSX.Element {
  const { consentState, host, handleStartLogging, handleAlwaysLog } = useConsentCheck()

  if (consentState === 'checking') {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 flex items-center justify-center">
        <p className="text-sm text-stone-500 dark:text-stone-400">Checking consent...</p>
      </div>
    )
  }

  if (consentState === 'not-consented') {
    return (
      <ConsentView host={host} onStartLogging={handleStartLogging} onAlwaysLog={handleAlwaysLog} />
    )
  }

  return (
    <LoggyProvider>
      <AppContent />
    </LoggyProvider>
  )
}
