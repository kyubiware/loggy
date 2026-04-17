import { Coins } from 'lucide-react'
import type React from 'react'
import { Tooltip } from '../../../shared/components/Tooltip'

interface TokenCountBadgeProps {
  tokenEstimate: number
}

function formatTokenCount(tokenEstimate: number): string {
  if (tokenEstimate >= 1_000_000) {
    return `${(tokenEstimate / 1_000_000).toFixed(1)}M`
  }

  if (tokenEstimate >= 1_000) {
    return `${(tokenEstimate / 1_000).toFixed(1)}k`
  }

  return tokenEstimate.toString()
}

export function TokenCountBadge({ tokenEstimate }: TokenCountBadgeProps): React.JSX.Element {
  const formattedTokenEstimate = formatTokenCount(tokenEstimate)

  return (
    <div className="text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 font-semibold">
      <Tooltip content="Estimated token count for export">
        <span className="flex items-center gap-1" data-testid="token-count">
          <Coins size={14} aria-hidden="true" />≈{formattedTokenEstimate}
        </span>
      </Tooltip>
    </div>
  )
}
