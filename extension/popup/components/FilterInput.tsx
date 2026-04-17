import type React from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Tooltip } from '../../shared/components/Tooltip'

export interface FilterInputProps {
  icon: React.ReactNode
  iconTitle?: string
  placeholder: string
  value: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  visible: boolean
  onToggleVisibility: () => void
  visibleLabel: string
  hiddenLabel: string
}

export function FilterInput({
  icon,
  iconTitle,
  placeholder,
  value,
  onChange,
  visible,
  onToggleVisibility,
  visibleLabel,
  hiddenLabel,
}: FilterInputProps): React.JSX.Element {
  return (
    <div className='flex items-center gap-1.5'>
      <label
        className='text-stone-500 dark:text-stone-400 flex items-center justify-center w-5'
        title={iconTitle}
      >
        {icon}
      </label>
      <div className='relative flex-1'>
        <input
          className='w-full rounded border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-2.5 py-1 pr-7 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500'
          type='text'
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
        <div className='absolute right-1 top-1/2 -translate-y-1/2'>
          <Tooltip content={visible ? visibleLabel : hiddenLabel}>
            <button
              className={`flex items-center justify-center p-1 rounded transition-colors ${visible ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30' : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'}`}
              type='button'
              onClick={onToggleVisibility}
              aria-pressed={visible}
            >
              {visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
