import type React from 'react'

import iconUrl from '../../icons/icon48.png'

declare const __BUILD_KEY__: string

export interface PopupHeaderProps {
  connected: boolean
}

export function PopupHeader({
  connected,
}: PopupHeaderProps): React.JSX.Element {
  return (
    <div className='flex items-center justify-between border-b border-stone-200 dark:border-stone-700 pb-2 max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:bg-white max-sm:dark:bg-stone-900'>
      <h1 className='text-lg font-semibold flex items-center gap-2'>
        <img src={iconUrl} alt='Loggy' className='w-6 h-6' />
        Loggy
      </h1>
      <span className='text-xs text-stone-400 font-mono'>{__BUILD_KEY__}</span>
    </div>
  )
}
