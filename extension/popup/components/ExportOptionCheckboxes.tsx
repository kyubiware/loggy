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

const TOGGLE_CONFIGS: Array<[ToggleSettingKey, string]> = [
  ['includeAgentContext', 'Include LLM guidance'],
  ['includeResponseBodies', 'Include response bodies'],
  ['truncateConsoleLogs', 'Truncate console logs'],
  ['truncateResponseBodies', 'Truncate response bodies'],
  ['redactSensitiveInfo', 'Redact sensitive info'],
  ['deduplicateApiCalls', 'Deduplicate API calls'],
  ['networkExportEnabled', 'Network export to server'],
  ['autoServerSync', 'Auto sync to server'],
  ['preserveLogs', 'Preserve logs on reload'],
]

export function ExportOptionCheckboxes({
  settings,
  onToggle,
  onSetTokenLimit,
}: ExportOptionCheckboxesProps): React.JSX.Element {
  return (
    <div className='flex flex-col gap-2'>
      {TOGGLE_CONFIGS.map(([key, label]) => (
        <OptionCheckbox
          key={key}
          testId={key}
          label={label}
          checked={settings[key]}
          onChange={() => onToggle(key)}
        />
      ))}
      <div className='flex items-center gap-2 mt-1'>
        <label className='text-xs text-stone-600 dark:text-stone-400 whitespace-nowrap'>
          Token limit
        </label>
        <input
          type='number'
          min={0}
          step={1000}
          value={settings.maxTokenLimit === 0 ? '' : settings.maxTokenLimit}
          placeholder='Off'
          onChange={(event) => {
            const raw = Number.parseInt(event.target.value, 10)
            const value = Number.isNaN(raw) ? 0 : Math.max(0, Math.round(raw / 1000) * 1000)
            onSetTokenLimit(value)
          }}
          className='flex-1 px-2 py-1 text-xs text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-700 border border-stone-200 dark:border-stone-600 rounded'
          title='Maximum estimated tokens per tab (0 = no limit)'
        />
      </div>
    </div>
  )
}
