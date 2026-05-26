import {
  Brain,
  CopyPlus,
  FileText,
  Globe,
  Minus,
  Plus,
  RefreshCw,
  Scissors,
  Shield,
  Archive,
} from 'lucide-react'

import { OptionCheckbox } from '../../shared/components/OptionCheckbox'
import type { PersistedLoggySettings } from '../../types/state'

export type ToggleSettingKey =
  | 'includeAgentContext'
  | 'includeResponseBodies'
  | 'truncateConsoleLogs'
  | 'truncateResponseBodies'
  | 'redactSensitiveInfo'
  | 'deduplicateApiCalls'
  | 'networkExportEnabled'
  | 'autoServerSync'
  | 'preserveLogs'

export interface ExportOptionCheckboxesProps {
  settings: PersistedLoggySettings
  onToggle: (key: ToggleSettingKey) => void
  onSetTokenLimit: (value: number) => void
}

const TOGGLE_CONFIGS: Array<[ToggleSettingKey, string, React.JSX.Element]> = [
  ['includeAgentContext', 'Include LLM guidance', <Brain size={13} />],
  ['includeResponseBodies', 'Include response bodies', <FileText size={13} />],
  ['truncateConsoleLogs', 'Truncate console logs', <Scissors size={13} />],
  [
    'truncateResponseBodies',
    'Truncate response bodies',
    <Scissors size={13} className='rotate-90' />,
  ],
  ['redactSensitiveInfo', 'Redact sensitive info', <Shield size={13} />],
  ['deduplicateApiCalls', 'Deduplicate API calls', <CopyPlus size={13} />],
  ['networkExportEnabled', 'Network export to server', <Globe size={13} />],
  ['autoServerSync', 'Auto sync to server', <RefreshCw size={13} />],
  ['preserveLogs', 'Preserve logs on reload', <Archive size={13} />],
]

export function ExportOptionCheckboxes({
  settings,
  onToggle,
  onSetTokenLimit,
}: ExportOptionCheckboxesProps): React.JSX.Element {
  return (
    <div className='flex flex-col gap-2'>
      {TOGGLE_CONFIGS.map(([key, label, icon]) => (
        <OptionCheckbox
          key={key}
          testId={key}
          label={label}
          icon={icon}
          checked={settings[key]}
          onChange={() => onToggle(key)}
        />
      ))}
      <div className='flex items-center gap-2 mt-1'>
        <label className='text-xs text-stone-600 dark:text-stone-400 whitespace-nowrap'>
          Token limit
        </label>
        <div
          className='flex items-center gap-0.5'
          title='Maximum estimated tokens per tab (0 = no limit)'
        >
          <button
            type='button'
            onClick={() => onSetTokenLimit(Math.max(0, settings.maxTokenLimit - 1000))}
            className='flex items-center justify-center w-6 h-6 rounded bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-600 transition-colors'
            aria-label='Decrease token limit'
          >
            <Minus size={12} />
          </button>
          <span className='flex items-center justify-center w-12 px-1 py-1 text-xs text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded text-center font-medium'>
            {settings.maxTokenLimit === 0 ? 'Off' : `${settings.maxTokenLimit / 1000}K`}
          </span>
          <button
            type='button'
            onClick={() => onSetTokenLimit(settings.maxTokenLimit + 1000)}
            className='flex items-center justify-center w-6 h-6 rounded bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-600 transition-colors'
            aria-label='Increase token limit'
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
