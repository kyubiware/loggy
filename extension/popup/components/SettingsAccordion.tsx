import type { ReactNode } from 'react'

import {
  Brain,
  ChevronDown,
  FileText,
  Scissors,
  Shield,
  CopyPlus,
  Globe,
  RefreshCw,
  Archive,
} from 'lucide-react'

import { IconButtonToggle } from '../../shared/components/IconButtonToggle'
import type { ToggleSettingKey } from './ExportOptionCheckboxes'
import type { PersistedLoggySettings } from '../../types/state'

interface SettingsAccordionProps {
  children: ReactNode
  defaultOpen: boolean
  onToggle: () => void
  settings: PersistedLoggySettings
  onToggleSetting: (key: ToggleSettingKey) => void
}

const SETTING_ICONS: Array<{
  key: ToggleSettingKey
  icon: ReactNode
  label: string
}> = [
  { key: 'includeAgentContext', icon: <Brain size={14} />, label: 'Include LLM guidance' },
  { key: 'includeResponseBodies', icon: <FileText size={14} />, label: 'Include response bodies' },
  { key: 'truncateConsoleLogs', icon: <Scissors size={14} />, label: 'Truncate console logs' },
  {
    key: 'truncateResponseBodies',
    icon: <Scissors size={14} className='rotate-90' />,
    label: 'Truncate response bodies',
  },
  { key: 'redactSensitiveInfo', icon: <Shield size={14} />, label: 'Redact sensitive info' },
  { key: 'deduplicateApiCalls', icon: <CopyPlus size={14} />, label: 'Deduplicate API calls' },
  { key: 'networkExportEnabled', icon: <Globe size={14} />, label: 'Network export to server' },
  { key: 'autoServerSync', icon: <RefreshCw size={14} />, label: 'Auto sync to server' },
  { key: 'preserveLogs', icon: <Archive size={14} />, label: 'Preserve logs on reload' },
]

export function SettingsAccordion({
  children,
  defaultOpen,
  onToggle,
  settings,
  onToggleSetting,
}: SettingsAccordionProps) {
  return (
    <details
      className='group bg-stone-100 dark:bg-stone-800 rounded-lg overflow-hidden'
      open={defaultOpen}
    >
      <summary
        onClick={(e) => {
          e.preventDefault()
          onToggle()
        }}
        className='flex items-center justify-between cursor-pointer select-none px-3 py-2 text-sm font-medium text-stone-800 dark:text-stone-200 list-none [&::-webkit-details-marker]:hidden'
      >
        <div className='flex items-center gap-1 min-w-0'>
          <span className='shrink-0'>Settings</span>
          <div className='group-open:hidden flex items-center gap-0.5 ml-1'>
            {SETTING_ICONS.map(({ key, icon, label }) => (
              <span
                key={key}
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleSetting(key)
                }}
              >
                <IconButtonToggle
                  icon={icon}
                  label={label}
                  pressed={settings[key]}
                  onToggle={() => onToggleSetting(key)}
                  testId={`collapsed-${key}`}
                />
              </span>
            ))}
          </div>
        </div>
        <ChevronDown className='h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180' />
      </summary>

      <div className='p-3 flex flex-col gap-3'>{children}</div>
    </details>
  )
}
