import { Copy, RefreshCw, Trash2 } from 'lucide-react'
import type React from 'react'
import { useActions } from '../../LoggyContext'

export function ActionButtons(): React.JSX.Element {
  const { refresh, clearAll, copy } = useActions()

  return (
    <div className="flex flex-row gap-2">
      <button
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
        data-testid="refresh-button"
        type="button"
        aria-label="Refresh"
        title="Refresh"
        onClick={refresh}
      >
        <RefreshCw size={16} />
      </button>
      <button
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
        data-testid="clear-all-button"
        type="button"
        aria-label="Clear All"
        title="Clear All"
        onClick={clearAll}
      >
        <Trash2 size={16} />
      </button>
      <button
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors"
        data-testid="copy-button"
        type="button"
        aria-label="Copy to Clipboard + Server"
        title="Copy to Clipboard + Server"
        onClick={copy}
      >
        <Copy size={16} />
      </button>
    </div>
  )
}
