import React, { useEffect, useState } from 'react'
import type { HAREntry } from '../../../types/har'
import { useFilteredData } from '../hooks/useFilteredData'
import parseLine from './preview-line-parser'

interface PreviewContentProps {
  visible: boolean
}

interface MappedLine {
  text: string
  entry: HAREntry | undefined
  isExpandable: boolean
}

function formatResponseBody(text: string): string {
  try {
    return `${JSON.stringify(JSON.parse(text), null, 2)}`
  } catch {
    return text
  }
}

function computeMappedLines(
  previewText: string,
  networkEntries: HAREntry[] | undefined
): MappedLine[] {
  const lines = previewText.split('\n')
  let inNetworkSection = false
  let networkEntryIndex = 0

  return lines.map((line) => {
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

    return { text: line, entry, isExpandable }
  })
}

function PreviewLine({
  lineData,
  isExpanded,
  index,
  toggleRow,
  isLast,
}: {
  lineData: MappedLine
  isExpanded: boolean
  index: number
  toggleRow: (index: number) => void
  isLast: boolean
}) {
  if (lineData.isExpandable) {
    return (
      <React.Fragment>
        <button
          type="button"
          onClick={() => toggleRow(index)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse response' : 'Expand response'}
          data-testid={`network-entry-toggle-${index}`}
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
        {!isLast && '\n'}
      </React.Fragment>
    )
  }

  return (
    <React.Fragment>
      {parseLine(lineData.text)}
      {!isLast && '\n'}
    </React.Fragment>
  )
}

export default function PreviewContent({ visible }: PreviewContentProps): React.JSX.Element {
  const { previewText, filteredData } = useFilteredData()
  const networkEntries = filteredData?.networkEntries

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

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

  const mappedLines = computeMappedLines(previewText, networkEntries)

  return (
    <pre
      data-testid="preview-output"
      hidden={!visible}
      className={`font-mono text-xs bg-stone-50 dark:bg-stone-950 text-stone-800 dark:text-stone-300 flex-1 overflow-auto p-4 whitespace-pre m-0 ${!visible ? 'hidden' : ''}`.trim()}
    >
      {mappedLines.map((lineData, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lines don't have unique IDs
        <React.Fragment key={i}>
          <PreviewLine
            lineData={lineData}
            isExpanded={expandedRows.has(i)}
            index={i}
            toggleRow={toggleRow}
            isLast={i === mappedLines.length - 1}
          />
        </React.Fragment>
      ))}
    </pre>
  )
}
