import type React from 'react'

import { Check, Copy, Pause, Play } from 'lucide-react'

import iconUrl from '../../icons/icon48.png'

export interface PopupHeaderProps {
  connected: boolean
  copyStatus?: 'idle' | 'success' | 'error' | 'no-data'
  onCopy?: () => void
  hasData?: boolean
  showLoggingToggle?: boolean
  isLoggingActive?: boolean
  onToggleLogging?: () => void
}

export function PopupHeader({
  connected,
  copyStatus = 'idle',
  onCopy,
  hasData = false,
  showLoggingToggle = false,
  isLoggingActive = false,
  onToggleLogging,
}: PopupHeaderProps): React.JSX.Element {
  return (
    <div className='flex items-center justify-between border-b border-stone-200 dark:border-stone-700 pb-2 max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:bg-white max-sm:dark:bg-stone-900'>
      <h1 className='text-lg font-semibold flex items-center gap-2'>
        <img src={iconUrl} alt='Loggy' className='w-6 h-6' />
        Loggy
      </h1>
      <div className='flex items-center gap-2'>
        {showLoggingToggle && (
          <button
            type='button'
            onClick={onToggleLogging}
            className={`p-1.5 rounded transition-colors ${
              isLoggingActive
                ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-900/40'
                : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-800'
            }`}
            title={isLoggingActive ? 'Stop Logging' : 'Start Logging'}
          >
            {isLoggingActive ? <Pause size={16} /> : <Play size={16} />}
          </button>
        )}
        {copyStatus === 'success' && (
          <Check size={14} className='text-green-600 dark:text-green-400' />
        )}
        <button
          type='button'
          onClick={onCopy}
          disabled={!hasData}
          className={`p-1.5 rounded transition-colors ${
            hasData
              ? 'text-stone-500 hover:text-stone-800 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-800'
              : 'text-stone-300 cursor-not-allowed dark:text-stone-700'
          }`}
          title='Copy to clipboard'
        >
          <Copy size={16} />
        </button>
      </div>
    </div>
  )
}
