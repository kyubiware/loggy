import type React from 'react'
import { useEffect, useState } from 'react'

import { browser } from '../../browser-apis'
import type { AlwaysLogHost } from '../../types/messages'

export interface AlwaysLogHostsProps {
  onRemove: (host: string) => void
}

export function AlwaysLogHosts({ onRemove }: AlwaysLogHostsProps): React.JSX.Element {
  const [hosts, setHosts] = useState<AlwaysLogHost[]>([])

  const fetchHosts = async () => {
    try {
      const response = await browser.runtime.sendMessage<{ type: string; hosts: AlwaysLogHost[] }>({ type: 'get-always-log-hosts' })
      if (response) setHosts(response.hosts ?? [])
    } catch {
      // Ignore send failures
    }
  }

  useEffect(() => {
    fetchHosts()
  }, [])

  if (hosts.length === 0) {
    return <></>
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-[10px] uppercase tracking-wider text-stone-400 dark:text-stone-500 font-medium'>
        Always logging on:
      </span>
      <div className='flex flex-col gap-1'>
        {hosts.map((entry) => (
          <div
            key={entry.host}
            className='flex items-center justify-between bg-stone-50 dark:bg-stone-800 px-2 py-1 rounded text-xs'
          >
            <span className='font-mono text-stone-700 dark:text-stone-300 truncate'>
              {entry.host}
            </span>
            <button
              type='button'
              onClick={() => {
                onRemove(entry.host)
                // Optimistically update the list
                setHosts(hosts.filter(h => h.host !== entry.host))
              }}
              className='ml-2 text-stone-400 hover:text-red-500 dark:text-stone-500 dark:hover:text-red-400 transition-colors flex-shrink-0'
              title={`Remove ${entry.host}`}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
