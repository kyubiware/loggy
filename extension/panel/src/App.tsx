import type React from 'react'
import { AppContent } from './AppContent'
import { LoggyProvider } from './LoggyContext'

export default function App(): React.JSX.Element {
  return (
    <LoggyProvider>
      <AppContent />
    </LoggyProvider>
  )
}
