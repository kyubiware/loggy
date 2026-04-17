import React from 'react'

interface TabButtonProps {
  children: React.ReactNode
  onClick: () => void
  active: boolean
  'data-testid'?: string
  'aria-label'?: string
}

const TabButton = React.memo(function TabButton({
  children,
  onClick,
  active,
  'data-testid': dataTestId,
  'aria-label': ariaLabel,
}: TabButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      data-testid={dataTestId}
      aria-label={ariaLabel}
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
        active
          ? 'active bg-white dark:bg-stone-600 text-stone-900 dark:text-stone-100 shadow-sm'
          : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
      }`}
    >
      {children}
    </button>
  )
})

export default TabButton
