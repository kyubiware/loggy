import type React from 'react'

export interface PopupHeaderProps {
  connected: boolean
}

export function PopupHeader({ connected }: PopupHeaderProps): React.JSX.Element {
  return (
    <div className='flex items-center justify-between border-b border-stone-200 dark:border-stone-700 pb-2'>
      <h1 className='text-lg font-semibold flex items-center gap-2'>
        <span role='img' aria-label='Loggy'>
          🪵
        </span>{' '}
        Loggy
      </h1>
      <div className='flex items-center gap-2 text-sm'>
        <span
          className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
          title={connected ? 'Connected to Server' : 'Disconnected'}
        />
        <span className='text-stone-500 dark:text-stone-400'>
          {connected ? 'Connected' : 'Offline'}
        </span>
      </div>
    </div>
  )
}
