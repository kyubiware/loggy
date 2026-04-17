import type React from 'react'

import type { CaptureMode } from '../../types/messages'
import { MODE_ICONS, MODE_LABELS } from '../constants'

export interface CaptureModeDisplayProps {
  mode: CaptureMode
  logCount: number
}

export function CaptureModeDisplay({ mode, logCount }: CaptureModeDisplayProps): React.JSX.Element {
  return (
    <div className='flex flex-col gap-2 bg-stone-50 dark:bg-stone-800 p-3 rounded-md'>
      <div className='flex justify-between items-center'>
        <span className='text-sm text-stone-500 dark:text-stone-400'>Capture Mode</span>
        <span className='flex items-center gap-1.5 font-medium text-sm bg-white dark:bg-stone-700 px-2 py-1 rounded shadow-sm border border-stone-100 dark:border-stone-600'>
          <span>{MODE_ICONS[mode]}</span>
          <span>{MODE_LABELS[mode]}</span>
        </span>
      </div>
      <div className='flex justify-between items-center'>
        <span className='text-sm text-stone-500 dark:text-stone-400'>Captured Logs</span>
        <span className='font-mono bg-stone-200 dark:bg-stone-700 px-2 py-0.5 rounded text-sm font-semibold'>
          {logCount}
        </span>
      </div>
    </div>
  )
}
