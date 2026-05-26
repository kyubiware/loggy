import { Minus, Plus } from 'lucide-react'
import type React from 'react'
import { IconButtonToggle } from '../../../shared/components/IconButtonToggle'
import { TOGGLE_CONFIGS } from '../hooks/useLoggyActions'
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
  const settings = useSettings()
  const { toggleSetting, setMaxTokenLimit } = useActions()

  const toggles: ToggleConfig[] = TOGGLE_CONFIGS.map(({ key, label, icon: Icon }) => ({
    label,
    pressed: settings[key] as boolean,
    onToggle: () => toggleSetting(key),
    icon: <Icon size={16} />,
    // Only autoServerSync has an error state
    ...(key === 'autoServerSync' && settings.serverSyncError ? { error: true } : {}),
  }))

  return (
    <div className="flex items-center gap-0.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded p-0.5">
      {toggles.map((toggle) => (
        <ToggleButton key={toggle.label} {...toggle} />
      ))}
      <div
        className="flex items-center gap-1 ml-1 pl-1 border-l border-stone-200 dark:border-stone-700"
        title="Maximum estimated tokens per tab (0 = no limit). Oldest logs are purged when exceeded."
      >
        <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 whitespace-nowrap">
          Token limit
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setMaxTokenLimit(Math.max(0, settings.maxTokenLimit - 1000))}
            className="flex items-center justify-center w-5 h-5 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
            aria-label="Decrease token limit"
          >
            <Minus size={10} />
          </button>
          <span className="flex items-center justify-center w-10 px-0.5 py-0.5 text-[11px] text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 rounded text-center font-medium">
            {settings.maxTokenLimit === 0 ? 'Off' : `${settings.maxTokenLimit / 1000}K`}
          </span>
          <button
            type="button"
            onClick={() => setMaxTokenLimit(settings.maxTokenLimit + 1000)}
            className="flex items-center justify-center w-5 h-5 rounded bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
            aria-label="Increase token limit"
          >
            <Plus size={10} />
          </button>
        </div>
      </div>
    </div>
  )
}
