import { useCallback, useEffect, useRef, useState } from 'react'
import { writeClipboard } from '../../utils/clipboard'
import { pushToServer } from '../../shared/server-export'

type CopyStatus = 'idle' | 'success' | 'error' | 'no-data'

export function usePopupExport({
  markdown,
  hasData,
  serverConnected,
  serverUrl,
}: {
  markdown: string | null
  hasData: boolean
  serverConnected: boolean
  serverUrl: string
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

      // Also push to server if connected
      if (serverConnected && serverUrl) {
        void pushToServer(serverUrl, markdown)
      }
    } catch {
      setStatus('error')
    }
  }, [hasData, markdown, serverConnected, serverUrl, setStatus])

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
