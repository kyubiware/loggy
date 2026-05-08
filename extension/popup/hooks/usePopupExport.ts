import { useCallback, useEffect, useRef, useState } from 'react'
import { writeClipboard } from '../../utils/clipboard'

type CopyStatus = 'idle' | 'success' | 'error' | 'no-data'

export function usePopupExport({
  markdown,
  hasData,
}: {
  markdown: string | null
  hasData: boolean
}): {
  copyToClipboard: () => Promise<void>
  copyStatus: CopyStatus
} {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setStatus = useCallback((status: CopyStatus) => {
    setCopyStatus(status)

    if (resetTimeoutRef.current !== null) {
      clearTimeout(resetTimeoutRef.current)
    }

    resetTimeoutRef.current = setTimeout(() => {
      setCopyStatus('idle')
      resetTimeoutRef.current = null
    }, 2000)
  }, [])

  const copyToClipboard = useCallback(async () => {
    if (!hasData || !markdown) {
      setStatus('no-data')
      return
    }

    try {
      await writeClipboard(markdown)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }, [hasData, markdown, setStatus])

  useEffect(
    () => () => {
      if (resetTimeoutRef.current !== null) {
        clearTimeout(resetTimeoutRef.current)
      }
    },
    [],
  )

  return { copyToClipboard, copyStatus }
}
