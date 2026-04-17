import { Monitor, Wifi } from 'lucide-react'
import type React from 'react'
import { Tooltip } from '../../../shared/components/Tooltip'

interface StatsSummaryProps {
  statsText: string
  consoleCount: number
  networkCount: number
}

export function StatsSummary({
  statsText,
  consoleCount,
  networkCount,
}: StatsSummaryProps): React.JSX.Element {
  return (
    <>
      <div data-testid="stats-summary" className="sr-only">
        {statsText}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 font-semibold">
        <div className="flex items-center gap-3">
          <Tooltip content="Console logs (Total)">
            <span className="flex items-center gap-1" data-testid="console-stats">
              <Monitor size={14} aria-hidden="true" />
              {consoleCount}
            </span>
          </Tooltip>
          <Tooltip content="Network entries (Total)">
            <span className="flex items-center gap-1" data-testid="network-stats">
              <Wifi size={14} aria-hidden="true" />
              {networkCount}
            </span>
          </Tooltip>
        </div>
      </div>
    </>
  )
}
