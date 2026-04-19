import { useCallback, useEffect, useState } from 'react'

import type { GetTabExportDataMessage, TabExportDataResponse } from '../../types/messages'
import { useFirefoxDirectCapture } from './useFirefoxDirectCapture'

type PopupDataState = TabExportDataResponse

const createDefaultPopupData = (): PopupDataState => ({
  tokenCount: 0,
  markdown: '',
  hasData: false,
  logCount: 0,
})

/**
 * Reads exported tab data for the active browser tab.
 */
export function usePopupData(tabId?: number): PopupDataState & {
  loading: boolean
  refresh: () => void
} {
  const isFirefox = typeof chrome.debugger === 'undefined'
  const firefoxData = useFirefoxDirectCapture(tabId ?? -1)
  const [data, setData] = useState<PopupDataState>(createDefaultPopupData)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)

    if (isFirefox) {
      setLoading(false)
      return
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id

      if (!tabId) {
        setData(createDefaultPopupData())
        setLoading(false)
        return
      }

      const message: GetTabExportDataMessage = {
        type: 'get-tab-export-data',
        tabId,
      }

      chrome.runtime.sendMessage(message, (response: TabExportDataResponse | undefined) => {
        if (chrome.runtime.lastError || !response) {
          setData(createDefaultPopupData())
          setLoading(false)
          return
        }

        setData({
          tokenCount: response.tokenCount,
          markdown: response.markdown,
          hasData: response.hasData,
          logCount: response.logCount,
        })
        setLoading(false)
      })
    })
  }, [isFirefox])

  useEffect(() => {
    if (!isFirefox) {
      refresh()
    }
  }, [refresh, isFirefox])

  if (isFirefox) {
    return firefoxData
  }

  return { ...data, loading, refresh }
}
