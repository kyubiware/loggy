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
    maxTokenLimit,
  } = useSettings()

  const {
    toggleAgentContext,
    toggleResponseBodies,
    toggleConsoleTruncation,
    toggleRedactSensitive,
    toggleNetworkExport,
    toggleAutoServerSync,
    setMaxTokenLimit,
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
      <div className="flex items-center gap-1 ml-1 pl-1 border-l border-stone-200 dark:border-stone-700">
        <label
          htmlFor="token-limit"
          className="text-[11px] font-medium text-stone-500 dark:text-stone-400 whitespace-nowrap"
        >
          Token limit
        </label>
        <input
          id="token-limit"
          type="number"
          min={0}
          step={1000}
          value={maxTokenLimit === 0 ? '' : maxTokenLimit}
          placeholder="Off"
          onChange={(event) => {
            const value = Number.parseInt(event.target.value, 10)
            setMaxTokenLimit(Number.isNaN(value) ? 0 : Math.max(0, value))
          }}
          className="w-16 px-1 py-0.5 text-xs text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          title="Maximum estimated tokens per tab (0 = no limit). Oldest logs are purged when exceeded."
        />
      </div>
    </div>
  )
}
