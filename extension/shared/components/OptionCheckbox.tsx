import React from 'react'

interface OptionCheckboxProps {
  testId: string
  label: string
  checked: boolean
  onChange: () => void
}

export const OptionCheckbox = React.memo(function OptionCheckbox({
  testId,
  label,
  checked,
  onChange,
}: OptionCheckboxProps): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
      <input
        className="h-3.5 w-3.5 rounded border-stone-300 text-blue-600 focus:ring-blue-500"
        data-testid={testId}
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
      {label}
    </label>
  )
})
