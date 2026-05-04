import type { ReactNode } from 'react'

import { ChevronDown } from 'lucide-react'

interface SettingsAccordionProps {
  children: ReactNode
  defaultOpen: boolean
  onToggle: () => void
}

export function SettingsAccordion({ children, defaultOpen, onToggle }: SettingsAccordionProps) {
  return (
    <details
      className='group bg-stone-100 dark:bg-stone-800 rounded-lg overflow-hidden'
      open={defaultOpen}
    >
      <summary
        onClick={(e) => {
          e.preventDefault()
          onToggle()
        }}
        className='flex items-center justify-between cursor-pointer select-none px-3 py-2 text-sm font-medium text-stone-800 dark:text-stone-200 list-none [&::-webkit-details-marker]:hidden'
      >
        <span>Settings</span>
        <ChevronDown className='h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180' />
      </summary>

      <div className='p-3 flex flex-col gap-3'>{children}</div>
    </details>
  )
}
