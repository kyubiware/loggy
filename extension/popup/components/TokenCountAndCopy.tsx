import { Coins, Copy, Eye } from 'lucide-react'

import { Tooltip } from '../../shared/components/Tooltip'
import { formatTokenCount } from '../constants'

export interface TokenCountAndCopyProps {
  hasData: boolean
  tokenCount: number
  copyStatus: 'idle' | 'success' | 'error' | 'no-data'
  onCopy: () => void
  onPreview: () => void
}

export function TokenCountAndCopy({
  hasData,
  tokenCount,
  copyStatus,
  onCopy,
  onPreview,
}: TokenCountAndCopyProps): React.JSX.Element {
  return (
    <div className='flex items-center justify-between border-t border-stone-200 dark:border-stone-700 pt-3'>
      {hasData ? (
        <Tooltip content='Estimated token count for export'>
          <span className='flex items-center gap-1 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 font-semibold'>
            <Coins size={14} />≈{formatTokenCount(tokenCount)}
          </span>
        </Tooltip>
      ) : (
        <span className='text-xs text-stone-500 dark:text-stone-400'>No captured data</span>
      )}

      <div className='flex items-center gap-2'>
        <div className='w-14 text-center'>
          {copyStatus === 'success' && (
            <span className='text-xs text-green-600 dark:text-green-400'>Copied!</span>
          )}
          {copyStatus === 'error' && (
            <span className='text-xs text-red-600 dark:text-red-400'>Failed</span>
          )}
          {copyStatus === 'no-data' && (
            <span className='text-xs text-stone-500 dark:text-stone-400'>No data</span>
          )}
        </div>
        <button
          type='button'
          onClick={onPreview}
          disabled={!hasData}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            hasData
              ? 'bg-stone-800 text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-white'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed dark:bg-stone-800 dark:text-stone-600'
          }`}
        >
          <Eye size={14} />
          Preview
        </button>
        <button
          type='button'
          onClick={onCopy}
          disabled={!hasData}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            hasData
              ? 'bg-stone-800 text-white hover:bg-stone-700 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-white'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed dark:bg-stone-800 dark:text-stone-600'
          }`}
        >
          <Copy size={14} />
          Copy
        </button>
      </div>
    </div>
  )
}
