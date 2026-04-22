import { Brain, FileText, RefreshCw, Scissors, Shield, Upload } from 'lucide-react'
import type React from 'react'
import { IconButtonToggle } from '../../../shared/components/IconButtonToggle'
import { useActions, useSettings } from '../LoggyContext'

interface ToggleConfig {
  label: string
  pressed: boolean
  onToggle: () => void
  icon: React.ReactNode
  error?: boolean
}

function ToggleButton({ label, pressed, onToggle, icon, error }: ToggleConfig): React.JSX.Element {
  return (
    <div className="relative flex">
      <IconButtonToggle icon={icon} label={label} pressed={pressed} onToggle={onToggle} />
      {error && (
        <span className="absolute top-0 right-0 -mt-0.5 -mr-0.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-stone-900" />
      )}
    </div>
  )
}

export function ExportOptionToggles(): React.JSX.Element {
  const {
    includeAgentContext,
    includeResponseBodies,
    truncateConsoleLogs,
    redactSensitiveInfo,
    networkExportEnabled,
    autoServerSync,
    serverSyncError,
  } = useSettings()

  const {
    toggleAgentContext,
    toggleResponseBodies,
    toggleConsoleTruncation,
    toggleRedactSensitive,
    toggleNetworkExport,
    toggleAutoServerSync,
  } = useActions()

  const toggles: ToggleConfig[] = [
    {
      label: 'Include LLM guidance',
      pressed: includeAgentContext,
      onToggle: toggleAgentContext,
      icon: <Brain size={16} />,
    },
    {
      label: 'Include response bodies',
      pressed: includeResponseBodies,
      onToggle: toggleResponseBodies,
      icon: <FileText size={16} />,
    },
    {
      label: 'Truncate console logs',
      pressed: truncateConsoleLogs,
      onToggle: toggleConsoleTruncation,
      icon: <Scissors size={16} />,
    },
    {
      label: 'Redact sensitive info',
      pressed: redactSensitiveInfo,
      onToggle: toggleRedactSensitive,
      icon: <Shield size={16} />,
    },
    {
      label: 'Network export to server',
      pressed: networkExportEnabled,
      onToggle: toggleNetworkExport,
      icon: <Upload size={16} />,
    },
    {
      label: 'Auto sync to server',
      pressed: autoServerSync,
      onToggle: toggleAutoServerSync,
      error: serverSyncError,
      icon: <RefreshCw size={16} />,
    },
  ]

  return (
    <div className="flex items-center gap-0.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded p-0.5">
      {toggles.map((toggle) => (
        <ToggleButton key={toggle.label} {...toggle} />
      ))}
    </div>
  )
}
