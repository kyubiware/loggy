import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type * as React from 'react'

export interface TooltipProps {
  children: React.ReactNode
  content: string | React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export const Tooltip: React.FC<TooltipProps> = ({ children, content, side = 'top' }) => {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={4}
            className="z-50 bg-stone-800 text-white text-xs px-2 py-1 rounded shadow-md"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-stone-800" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
