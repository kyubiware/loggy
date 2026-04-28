import type React from 'react'

export interface ConsentViewProps {
  host: string
  onStartLogging: () => void
  onAlwaysLog: () => void
}

export function ConsentView({
  host,
  onStartLogging,
  onAlwaysLog,
}: ConsentViewProps): React.JSX.Element {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 flex items-center justify-center">
      <div className="flex flex-col gap-4 py-4 px-6 max-w-sm w-full">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-4xl">🔒</span>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Loggy is not capturing logs on this page
          </p>
          {host && <p className="text-xs text-stone-400 dark:text-stone-500 font-mono">{host}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onStartLogging}
            className="w-full py-2 px-4 rounded-md font-medium text-sm transition-colors bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Start Logging
          </button>
          <button
            type="button"
            onClick={onAlwaysLog}
            className="w-full py-2 px-4 rounded-md font-medium text-sm transition-colors bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
          >
            Always Log {host}
          </button>
        </div>

        <p className="text-[10px] text-stone-500 dark:text-stone-400 text-center leading-tight">
          &quot;Always Log&quot; will automatically capture on every visit to this site.
        </p>
      </div>
    </div>
  )
}
