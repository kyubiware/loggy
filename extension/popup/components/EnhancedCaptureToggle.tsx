import type React from 'react'

export interface EnhancedCaptureToggleProps {
  isEnhanced: boolean
  onToggle: () => void
}

export function EnhancedCaptureToggle({
  isEnhanced,
  onToggle,
}: EnhancedCaptureToggleProps): React.JSX.Element {
  return (
    <div className='flex flex-col gap-2 mt-2'>
      <button
        type='button'
        onClick={onToggle}
        className={`w-full py-2 px-4 rounded-md font-medium text-sm transition-colors ${
          isEnhanced
            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800'
            : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500'
        }`}
      >
        {isEnhanced ? 'Stop Enhanced Capture' : 'Start Enhanced Capture'}
      </button>
      <p className='text-[10px] text-stone-500 dark:text-stone-400 text-center mt-1 leading-tight'>
        Enhanced capture uses the Chrome Debugger API to catch early network requests.
      </p>
    </div>
  )
}
