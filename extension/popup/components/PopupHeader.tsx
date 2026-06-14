import type React from 'react'

import { Check, Coins, Copy, Pause, Play, Square, Trash2 } from 'lucide-react'

import iconUrl from '../../icons/icon48.png'
import { Tooltip } from '../../shared/components/Tooltip'
import { formatTokenCount } from '../constants'

export interface PopupHeaderProps {
  connected: boolean
  copyStatus?: 'idle' | 'success' | 'error' | 'no-data'
  onCopy?: () => void
  hasData?: boolean
  tokenCount?: number
  onClear?: () => void
  showLoggingToggle?: boolean
  isLoggingActive?: boolean
  onToggleLogging?: () => void
  onStopLogging?: () => void
}

export function PopupHeader({
  connected,
  copyStatus = 'idle',
  onCopy,
  hasData = false,
  tokenCount = 0,
  onClear,
  showLoggingToggle = false,
  isLoggingActive = false,
  onToggleLogging,
  onStopLogging,
}: PopupHeaderProps): React.JSX.Element {
  return (
    <div className='flex items-center justify-between border-b border-stone-200 dark:border-stone-700 pb-2 max-sm:sticky max-sm:top-0 max-sm:z-10 max-sm:bg-white max-sm:dark:bg-stone-900'>
      <h1 className='text-lg font-semibold flex items-center gap-2'>
        <img src={iconUrl} alt='Loggy' className='w-6 h-6' />
        Loggy
      </h1>
      <div className='flex items-center gap-2'>
        {hasData ? (
          <Tooltip content='Estimated token count for export'>
            <span className='flex items-center gap-1 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 font-semibold'>
              <Coins size={14} />
              ≈{formatTokenCount(tokenCount)}
            </span>
          </Tooltip>
        ) : (
          <span className='text-xs text-stone-500 dark:text-stone-400'>
            No captured data
          </span>
        )}
        {onClear && (
          <Tooltip content='Clear Logs'>
            <button
              type='button'
              onClick={onClear}
              disabled={!hasData}
              className={`flex items-center justify-center p-1.5 rounded text-xs transition-colors ${
                hasData
                  ? 'text-stone-400 hover:text-red-500 hover:bg-red-50 dark:text-stone-500 dark:hover:text-red-400 dark:hover:bg-red-950'
                  : 'text-stone-300 cursor-not-allowed dark:text-stone-700'
              }`}
            >
              <Trash2 size={14} />
            </button>
          </Tooltip>
        )}
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
        {onStopLogging && isLoggingActive && (
          <button
            type='button'
            onClick={onStopLogging}
            className='p-1.5 rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/40 transition-colors'
            title='Stop Logging'
          >
            <Square size={16} />
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
