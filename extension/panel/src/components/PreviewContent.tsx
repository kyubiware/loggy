import React, { useEffect, useState } from 'react'
import type { HAREntry } from '../../../types/har'
import { useFilteredData } from '../hooks/useFilteredData'

interface PreviewContentProps {
  visible: boolean
}

export default function PreviewContent({ visible }: PreviewContentProps): React.JSX.Element {
  const { previewText, filteredData } = useFilteredData()

  const networkEntries = filteredData?.networkEntries

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  const formatResponseBody = (text: string): string => {
    try {
      return `${JSON.stringify(JSON.parse(text), null, 2)}`
    } catch {
      return text
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: previewText change triggers reset
  useEffect(() => {
    setExpandedRows(new Set())
  }, [previewText])

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const parseLine = (line: string) => {
    if (/^=== .* ===$/.test(line)) {
      return <span className="text-stone-950 dark:text-stone-50 font-semibold">{line}</span>
    }

    if (line.startsWith('  ')) {
      return <span className="text-stone-700 dark:text-stone-200">{line}</span>
    }

    const parts: React.ReactNode[] = []
    let remaining = line
    let keyCount = 0

    // 1. Bullet
    if (remaining.startsWith('- ')) {
      parts.push('- ')
      remaining = remaining.slice(2)
    }

    // 2. Count Prefix
    const countMatch = remaining.match(/^(\(\d+x\))( |$)/)
    if (countMatch) {
      parts.push(
        <span key={`count-${keyCount++}`} className="text-sky-700 dark:text-sky-300">
          {countMatch[1]}
        </span>
      )
      parts.push(countMatch[2])
      remaining = remaining.slice(countMatch[0].length)
    }

    // 3. Level or HTTP Method
    const levelMethodMatch = remaining.match(/^(\[(?:error|warn|log|info|debug|[A-Z]+)\])( |$)/)
    let isMethod = false
    if (levelMethodMatch) {
      const token = levelMethodMatch[1]
      let className = ''

      if (token === '[error]') className = 'text-rose-700 dark:text-rose-300'
      else if (token === '[warn]') className = 'text-amber-700 dark:text-amber-300'
      else if (['[log]', '[info]', '[debug]'].includes(token))
        className = 'text-emerald-700 dark:text-emerald-300'
      else {
        className = 'text-cyan-700 dark:text-cyan-300'
        isMethod = true
      }

      parts.push(
        <span key={`level-${keyCount++}`} className={className}>
          {token}
        </span>
      )
      parts.push(levelMethodMatch[2])
      remaining = remaining.slice(levelMethodMatch[0].length)
    }

    // 4. Timestamp or Status
    const timestampMatch = remaining.match(/^(\d{2}:\d{2}:\d{2}(?: -> \d{2}:\d{2}:\d{2})?)( |$)/)
    if (timestampMatch) {
      parts.push(
        <span key={`time-${keyCount++}`} className="text-stone-500 dark:text-stone-400">
          {timestampMatch[1]}
        </span>
      )
      parts.push(timestampMatch[2])
      remaining = remaining.slice(timestampMatch[0].length)
    } else if (isMethod) {
      const statusMatch = remaining.match(/^(\d{3}|N\/A)( |$)/)
      if (statusMatch) {
        const statusText = statusMatch[1]
        const status = parseInt(statusText, 10)
        let className = ''

        if (statusText === 'N/A') {
          className = 'text-stone-500 dark:text-stone-400'
        } else if (status >= 500 || status >= 400) {
          className = 'text-rose-700 dark:text-rose-300'
        } else if (status >= 300) {
          className = 'text-amber-700 dark:text-amber-300'
        } else {
          className = 'text-emerald-700 dark:text-emerald-300'
        }

        parts.push(
          <span key={`status-${keyCount++}`} className={className}>
            {statusText}
          </span>
        )
        parts.push(statusMatch[2])
        remaining = remaining.slice(statusMatch[0].length)
      }
    }

    // 5. URLs
    if (remaining) {
      if (isMethod) {
        parts.push(
          <span
            key={`url-${keyCount++}`}
            className="text-blue-700 dark:text-blue-300 underline decoration-blue-400/40"
          >
            {remaining}
          </span>
        )
      } else {
        const urlRegex = /(https?:\/\/[^\s]+)/g
        let match: RegExpExecArray | null = null
        let lastIndex = 0
        // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
        while ((match = urlRegex.exec(remaining)) !== null) {
          if (match.index > lastIndex) {
            parts.push(remaining.slice(lastIndex, match.index))
          }
          parts.push(
            <span
              key={`url-${keyCount++}`}
              className="text-blue-700 dark:text-blue-300 underline decoration-blue-400/40"
            >
              {match[0]}
            </span>
          )
          lastIndex = match.index + match[0].length
        }
        if (lastIndex < remaining.length) {
          parts.push(remaining.slice(lastIndex))
        }
      }
    }

    return parts.length > 0 ? parts : line
  }

  const lines = previewText.split('\n')

  let inNetworkSection = false
  let networkEntryIndex = 0

  const mappedLines = lines.map((line) => {
    if (line === '=== Network Entries ===') {
      inNetworkSection = true
    } else if (line.startsWith('=== ') && line !== '=== Network Entries ===') {
      inNetworkSection = false
    }

    let entry: HAREntry | undefined
    let isExpandable = false

    const isNetworkRow = inNetworkSection && /^\[[A-Z]+\] (?:\d{3}|N\/A) /.test(line)

    if (isNetworkRow) {
      entry = networkEntries?.[networkEntryIndex]
      if (entry) {
        isExpandable = (entry.response?.content?.text?.trim().length ?? 0) > 0
      }
      networkEntryIndex++
    }

    return {
      text: line,
      entry,
      isExpandable,
    }
  })

  return (
    <pre
      data-testid="preview-output"
      hidden={!visible}
      className={`font-mono text-xs bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-300 flex-1 overflow-auto p-4 whitespace-pre m-0 ${!visible ? 'hidden' : ''}`.trim()}
    >
      {mappedLines.map((lineData, i) => {
        const isExpanded = expandedRows.has(i)

        if (lineData.isExpandable) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines don't have unique IDs
            <React.Fragment key={i}>
              <button
                type="button"
                onClick={() => toggleRow(i)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? 'Collapse response' : 'Expand response'}
                data-testid={`network-entry-toggle-${i}`}
                className="cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-700 text-inherit font-inherit text-left px-1 -mx-1 rounded"
              >
                {parseLine(lineData.text)}
                <span className="ml-2 text-stone-500 dark:text-stone-400 select-none">
                  {isExpanded ? '▼' : '▶'}
                </span>
              </button>
              {isExpanded && lineData.entry?.response?.content?.text && (
                <span className="block whitespace-pre-wrap overflow-x-auto pl-4 text-stone-600 dark:text-stone-400 text-[11px] border-l-2 border-stone-300 dark:border-stone-600 ml-2">
                  {formatResponseBody(lineData.entry.response.content.text)}
                </span>
              )}
              {i < mappedLines.length - 1 ? '\n' : null}
            </React.Fragment>
          )
        }

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines don't have unique IDs
          <React.Fragment key={i}>
            {parseLine(lineData.text)}
            {i < mappedLines.length - 1 ? '\n' : null}
          </React.Fragment>
        )
      })}
    </pre>
  )
}
