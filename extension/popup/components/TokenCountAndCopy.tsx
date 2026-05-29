import { Coins, Eye, Trash2 } from 'lucide-react'

import { Tooltip } from '../../shared/components/Tooltip'
import { formatTokenCount } from '../constants'

export interface TokenCountAndCopyProps {
  hasData: boolean
  tokenCount: number
  onPreview: () => void
  onClear: () => void
}

export function TokenCountAndCopy({
  hasData,
  tokenCount,
  onPreview,
  onClear,
}: TokenCountAndCopyProps): React.JSX.Element {
  return (
    <div className='flex items-center justify-between border-t border-stone-200 dark:border-stone-700 pt-3'>
      <div className='flex items-center gap-2'>
        {hasData ? (
          <Tooltip content='Estimated token count for export'>
            <span className='flex items-center gap-1 text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 font-semibold'>
              <Coins size={14} />≈{formatTokenCount(tokenCount)}
            </span>
          </Tooltip>
        ) : (
          <span className='text-xs text-stone-500 dark:text-stone-400'>No captured data</span>
        )}
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
    </div>
  )
}
