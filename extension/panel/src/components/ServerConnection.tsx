import type React from 'react'
import { useDebouncedFilter } from '../../../shared/hooks/useDebouncedFilter'
import { useActions, useSettings } from '../LoggyContext'

export function ServerConnection(): React.JSX.Element {
  const { serverUrl, serverConnected } = useSettings()
  const { setServerUrl } = useActions()

  const { localValue, handleChange } = useDebouncedFilter(serverUrl, setServerUrl)

  return (
    <div className="flex items-center gap-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded p-1">
      <div
        className={`w-2.5 h-2.5 rounded-full ml-1 ${serverConnected ? 'bg-green-500' : 'bg-red-500'}`}
        title={serverConnected ? 'Connected to server' : 'Disconnected from server'}
      />
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder="Server URL"
        className="w-48 text-xs bg-transparent border-none focus:outline-none text-stone-700 dark:text-stone-300"
      />
    </div>
  )
}
