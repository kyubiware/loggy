import type React from 'react'

export interface PopupHeaderProps {
  connected: boolean
}

export function PopupHeader({
  connected,
}: PopupHeaderProps): React.JSX.Element {
  return (
    <div className='flex items-center justify-between border-b border-stone-200 dark:border-stone-700 pb-2'>
      <h1 className='text-lg font-semibold flex items-center gap-2'>
        <span role='img' aria-label='Loggy'>
          🪵
        </span>{' '}
        Loggy
      </h1>
    </div>
  )
}
