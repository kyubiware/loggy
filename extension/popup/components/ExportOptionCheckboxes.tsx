import { OptionCheckbox } from '../../shared/components/OptionCheckbox'
import type { PersistedLoggySettings } from '../../types/state'

export type ToggleSettingKey =
  | 'includeAgentContext'
  | 'includeResponseBodies'
  | 'truncateConsoleLogs'
  | 'redactSensitiveInfo'
  | 'networkExportEnabled'
  | 'autoServerSync'

export interface ExportOptionCheckboxesProps {
  settings: PersistedLoggySettings
  onToggle: (key: ToggleSettingKey) => void
}

const TOGGLE_CONFIGS: Array<[ToggleSettingKey, string]> = [
  ['includeAgentContext', 'Include LLM guidance'],
  ['includeResponseBodies', 'Include response bodies'],
  ['truncateConsoleLogs', 'Truncate console logs'],
  ['redactSensitiveInfo', 'Redact sensitive info'],
  ['networkExportEnabled', 'Network export to server'],
  ['autoServerSync', 'Auto sync to server'],
]

export function ExportOptionCheckboxes({
  settings,
  onToggle,
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
    </div>
  )
}
