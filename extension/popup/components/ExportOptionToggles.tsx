import {
  Brain,
  FileText,
  RefreshCw,
  Scissors,
  Shield,
  Upload,
  type LucideIcon,
} from 'lucide-react'

import { IconButtonToggle } from '../../shared/components/IconButtonToggle'
import type { PersistedLoggySettings } from '../../types/state'

export type ToggleSettingKey =
  | 'includeAgentContext'
  | 'includeResponseBodies'
  | 'truncateConsoleLogs'
  | 'redactSensitiveInfo'
  | 'networkExportEnabled'
  | 'autoServerSync'

export interface ExportOptionTogglesProps {
  settings: PersistedLoggySettings
  onToggle: (key: ToggleSettingKey) => void
}

const TOGGLE_CONFIGS: [ToggleSettingKey, string, LucideIcon][] = [
  ['includeAgentContext', 'Include LLM guidance', Brain],
  ['includeResponseBodies', 'Include response bodies', FileText],
  ['truncateConsoleLogs', 'Truncate console logs', Scissors],
  ['redactSensitiveInfo', 'Redact sensitive info', Shield],
  ['networkExportEnabled', 'Network export to server', Upload],
  ['autoServerSync', 'Auto sync to server', RefreshCw],
]

export function ExportOptionToggles({
  settings,
  onToggle,
}: ExportOptionTogglesProps): React.JSX.Element {
  return (
    <div className='flex justify-center'>
      <div className='flex items-center gap-0.5 bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded p-0.5'>
        {TOGGLE_CONFIGS.map(([key, label, Icon]) => (
          <IconButtonToggle
            key={key}
            icon={<Icon size={16} />}
            label={label}
            pressed={settings[key]}
            onToggle={() => onToggle(key)}
          />
        ))}
      </div>
    </div>
  )
}
