import { RefreshCw } from 'lucide-react'
import type React from 'react'

import { useDebouncedFilter } from '../../shared/hooks/useDebouncedFilter'

export interface ServerConnectionProps {
  serverUrl: string
  onServerUrlChange: (url: string) => void
  serverConnected: boolean
  onRetry: () => void
}

export function ServerConnection({
  serverUrl,
  onServerUrlChange,
  serverConnected,
  onRetry,
}: ServerConnectionProps): React.JSX.Element {
  const { localValue, handleChange } = useDebouncedFilter(serverUrl, onServerUrlChange)

  return (
    <div className='flex items-center gap-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded p-1'>
      <div
        className={`w-2.5 h-2.5 rounded-full ml-1 shrink-0 ${serverConnected ? 'bg-green-500' : 'bg-red-500'}`}
        title={serverConnected ? 'Connected to server' : 'Disconnected from server'}
      />
      <input
        type='text'
        value={localValue}
        onChange={handleChange}
        placeholder='Server URL'
        className='flex-1 min-w-0 text-xs bg-transparent border-none focus:outline-none text-stone-700 dark:text-stone-300'
      />
      <button
        type='button'
        onClick={onRetry}
        className='p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 shrink-0'
        title='Retry connection'
      >
        <RefreshCw size={12} />
      </button>
    </div>
  )
}
