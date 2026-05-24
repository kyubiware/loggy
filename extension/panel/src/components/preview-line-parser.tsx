import type React from 'react'

// Sub-parsers for token types in a log line

function tryParseCountPrefix(
  remaining: string,
  keyCount: { current: number }
): { node: React.ReactNode; remaining: string } | null {
  const match = remaining.match(/^(\(\d+x\))( |$)/)
  if (!match) return null
  return {
    node: (
      <span key={`count-${keyCount.current++}`} className="text-sky-700 dark:text-sky-300">
        {match[1]}
      </span>
    ),
    remaining: remaining.slice(match[0].length),
  }
}

function tryParseLevelOrMethod(
  remaining: string,
  keyCount: { current: number }
): { node: React.ReactNode; isMethod: boolean; remaining: string } | null {
  const match = remaining.match(/^(\[(?:error|warn|log|info|debug|[A-Z]+)\])( |$)/)
  if (!match) return null

  const token = match[1]
  let className = ''
  let isMethod = false

  if (token === '[error]') {
    className = 'text-rose-700 dark:text-rose-300'
  } else if (token === '[warn]') {
    className = 'text-amber-700 dark:text-amber-300'
  } else if (['[log]', '[info]', '[debug]'].includes(token)) {
    className = 'text-emerald-700 dark:text-emerald-300'
  } else {
    className = 'text-cyan-700 dark:text-cyan-300'
    isMethod = true
  }

  return {
    node: (
      <span key={`level-${keyCount.current++}`} className={className}>
        {token}
      </span>
    ),
    isMethod,
    remaining: remaining.slice(match[0].length),
  }
}

function tryParseTimestamp(
  remaining: string,
  keyCount: { current: number }
): { node: React.ReactNode; remaining: string } | null {
  const match = remaining.match(/^(\d{2}:\d{2}:\d{2}(?: -> \d{2}:\d{2}:\d{2})?)( |$)/)
  if (!match) return null
  return {
    node: (
      <span key={`time-${keyCount.current++}`} className="text-stone-500 dark:text-stone-400">
        {match[1]}
      </span>
    ),
    remaining: remaining.slice(match[0].length),
  }
}

function tryParseStatus(
  remaining: string,
  keyCount: { current: number }
): { node: React.ReactNode; remaining: string } | null {
  const match = remaining.match(/^(\d{3}|N\/A)( |$)/)
  if (!match) return null

  const statusText = match[1]
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

  return {
    node: (
      <span key={`status-${keyCount.current++}`} className={className}>
        {statusText}
      </span>
    ),
    remaining: remaining.slice(match[0].length),
  }
}

function tryParseUrlHighlight(
  remaining: string,
  isMethod: boolean,
  keyCount: { current: number }
): React.ReactNode {
  if (isMethod) {
    return (
      <span
        key={`url-${keyCount.current++}`}
        className="text-blue-700 dark:text-blue-300 underline decoration-blue-400/40"
      >
        {remaining}
      </span>
    )
  }

  const parts: React.ReactNode[] = []
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
        key={`url-${keyCount.current++}`}
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

  return parts.length > 0 ? parts : remaining
}

export default function parseLine(line: string): React.ReactNode {
  if (/^=== .* ===$/.test(line)) {
    return <span className="text-stone-950 dark:text-stone-50 font-semibold">{line}</span>
  }

  if (line.startsWith('  ')) {
    return <span className="text-stone-700 dark:text-stone-200">{line}</span>
  }

  const parts: React.ReactNode[] = []
  let remaining = line
  let isMethod = false
  const keyCount = { current: 0 }

  // 1. Bullet
  if (remaining.startsWith('- ')) {
    parts.push('- ')
    remaining = remaining.slice(2)
  }

  // 2. Count Prefix
  const countResult = tryParseCountPrefix(remaining, keyCount)
  if (countResult) {
    parts.push(countResult.node)
    remaining = countResult.remaining
    if (remaining) parts.push(' ')
  }

  // 3. Level or HTTP Method
  const lmResult = tryParseLevelOrMethod(remaining, keyCount)
  if (lmResult) {
    parts.push(lmResult.node)
    isMethod = lmResult.isMethod
    remaining = lmResult.remaining
    if (remaining) parts.push(' ')
  }

  // 4. Timestamp or Status
  const tsResult = tryParseTimestamp(remaining, keyCount)
  if (tsResult) {
    parts.push(tsResult.node)
    remaining = tsResult.remaining
    if (remaining) parts.push(' ')
  } else if (isMethod) {
    const statusResult = tryParseStatus(remaining, keyCount)
    if (statusResult) {
      parts.push(statusResult.node)
      remaining = statusResult.remaining
      if (remaining) parts.push(' ')
    }
  }

  // 5. URLs
  if (remaining) {
    parts.push(tryParseUrlHighlight(remaining, isMethod, keyCount))
  }

  return parts.length > 0 ? parts : line
}
