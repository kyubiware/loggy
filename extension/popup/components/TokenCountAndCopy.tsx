import { useState } from 'react'

import { ExternalLink, Maximize2, Minimize2 } from 'lucide-react'

import { Tooltip } from '../../shared/components/Tooltip'

export interface TokenCountAndCopyProps {
  hasData: boolean
  markdown: string
  onPreview: () => void
}

const COLLAPSED_TAIL_LENGTH = 300
const EXPANDED_TAIL_LENGTH = 2000

export function TokenCountAndCopy({
  hasData,
  markdown,
  onPreview,
}: TokenCountAndCopyProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const maxChars = expanded ? EXPANDED_TAIL_LENGTH : COLLAPSED_TAIL_LENGTH
  const isTruncated = markdown.length > maxChars
  const tail = markdown.length > maxChars ? `…${markdown.slice(-maxChars)}` : markdown
  const showPreview = hasData && markdown.length > 0

  return (
    <div className='border-t border-stone-200 dark:border-stone-700 pt-3 flex flex-col gap-2'>
      <div className='flex items-center justify-end gap-1'>
        <Tooltip content={expanded ? 'Collapse preview' : 'Expand preview'}>
          <button
            type='button'
            onClick={() => setExpanded(!expanded)}
            disabled={!showPreview}
            className={`flex items-center justify-center p-1.5 rounded text-xs transition-colors ${
              showPreview
                ? 'text-stone-500 hover:text-stone-700 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-800'
                : 'text-stone-300 cursor-not-allowed dark:text-stone-700'
            }`}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </Tooltip>
        <Tooltip content='Open full preview'>
          <button
            type='button'
            onClick={onPreview}
            disabled={!showPreview}
            className={`flex items-center justify-center p-1.5 rounded text-xs transition-colors ${
              showPreview
                ? 'text-stone-500 hover:text-stone-700 hover:bg-stone-100 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-800'
                : 'text-stone-300 cursor-not-allowed dark:text-stone-700'
            }`}
          >
            <ExternalLink size={14} />
          </button>
        </Tooltip>
      </div>

      {showPreview && (
        <textarea
          readOnly
          value={tail}
          className={`w-full rounded border border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-950 text-[11px] font-mono p-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-stone-700 dark:text-stone-300 ${
            expanded ? 'h-64' : 'h-24'
          } transition-all duration-200`}
        />
      )}
    </div>
  )
}
