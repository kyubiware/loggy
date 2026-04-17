import { Eye, EyeOff } from 'lucide-react'
import React from 'react'
import { Tooltip } from '../../../../shared/components/Tooltip'

interface FilterControlProps {
  id: string
  label: string
  icon?: React.ReactNode
  inputTestId: string
  toggleTestId: string
  placeholder: string
  value: string
  visible: boolean
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onToggleVisibility: () => void
}

export const FilterControl = React.memo(function FilterControl({
  id,
  label,
  icon,
  inputTestId,
  toggleTestId,
  placeholder,
  value,
  visible,
  onChange,
  onToggleVisibility,
}: FilterControlProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor={id}
        className="text-stone-500 dark:text-stone-400 flex items-center justify-center"
        title={label}
        aria-label={label}
      >
        {icon ? (
          <span className="flex items-center justify-center w-4 h-4">{icon}</span>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        )}
      </label>
      <div className="relative flex-1">
        <input
          id={id}
          className="w-full rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-2.5 py-1.5 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500"
          data-testid={inputTestId}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2">
          <Tooltip content={visible ? `Hide ${label}` : `Show ${label}`}>
            <button
              className={`flex items-center justify-center p-1 rounded transition-colors ${visible ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
              data-testid={toggleTestId}
              type="button"
              onClick={onToggleVisibility}
              aria-pressed={visible}
            >
              <span className="sr-only">{visible ? `Hide ${label}` : `Show ${label}`}</span>
              {visible ? (
                <Eye size={14} aria-hidden="true" />
              ) : (
                <EyeOff size={14} aria-hidden="true" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
})
