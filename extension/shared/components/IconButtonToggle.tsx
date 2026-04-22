import React, { type ReactNode } from 'react'
import { Tooltip } from './Tooltip'

export interface IconButtonToggleProps {
  icon: ReactNode
  label: string
  pressed: boolean
  onToggle: () => void
  testId?: string
  tooltip?: string
}

export const IconButtonToggle = React.memo(function IconButtonToggle({
  icon,
  label,
  pressed,
  onToggle,
  testId,
  tooltip,
}: IconButtonToggleProps): React.JSX.Element {
  const button = (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onToggle}
      data-testid={testId}
      className={`flex items-center justify-center w-6 h-6 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors ${
        pressed
          ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/30'
          : 'text-stone-500 dark:text-stone-400'
      }`}
    >
      {icon}
    </button>
  )

  return <Tooltip content={tooltip ?? label}>{button}</Tooltip>
})
