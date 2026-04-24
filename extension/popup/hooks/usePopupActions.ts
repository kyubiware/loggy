import { useEffect, useState } from 'react'

import { useDebouncedFilter } from '../../shared/hooks/useDebouncedFilter'
import type { StatusResponse } from '../../types/messages'
import { usePopupData } from './usePopupData'
import { usePopupExport } from './usePopupExport'
import { usePopupSettings } from './usePopupSettings'

export function usePopupActions() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [isFirefox, setIsFirefox] = useState(false)
  const [tabId, setTabId] = useState<number | undefined>(undefined)
  const [tabUrl, setTabUrl] = useState<string>('')

  const { settings, setSetting, loading: loadingSettings } = usePopupSettings()
  const { tokenCount, markdown, hasData, loading: loadingData } = usePopupData(tabId)
  const { copyToClipboard, copyStatus } = usePopupExport({ markdown, hasData })

  const {
    localValue: localConsoleFilter,
    handleChange: handleConsoleFilterChange,
  } = useDebouncedFilter(settings.consoleFilter || '', val =>
    setSetting('consoleFilter', val),
  )

  const {
    localValue: localNetworkFilter,
    handleChange: handleNetworkFilterChange,
  } = useDebouncedFilter(settings.networkFilter || '', val =>
    setSetting('networkFilter', val),
  )

  useEffect(() => {
    setIsFirefox(typeof chrome.debugger === 'undefined')

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0]?.id
      const url = tabs[0]?.url ?? ''
      setTabId(tabId)
      setTabUrl(url)
      if (!tabId) {
        setLoadingStatus(false)
        return
      }

      chrome.runtime.sendMessage(
        { type: 'get-status' },
        (response: StatusResponse) => {
          setStatus(response)
          setLoadingStatus(false)
        },
      )
    })
  }, [])

  const currentHost = (() => {
    try {
      return new URL(tabUrl).hostname
    } catch {
      return ''
    }
  })()

  const refreshStatus = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0]?.id
      if (!tabId) return
      chrome.runtime.sendMessage(
        { type: 'get-status' },
        (response: StatusResponse) => {
          setStatus(response)
        },
      )
    })
  }

  const handleStartLogging = () => {
    if (!tabId) return
    chrome.runtime.sendMessage(
      { type: 'start-logging', tabId },
      () => refreshStatus(),
    )
  }

  const handleStopLogging = () => {
    if (!tabId) return
    chrome.runtime.sendMessage(
      { type: 'stop-logging', tabId },
      () => refreshStatus(),
    )
  }

  const handleAlwaysLog = () => {
    if (!currentHost) return
    chrome.runtime.sendMessage(
      { type: 'add-always-log', host: currentHost },
      () => refreshStatus(),
    )
  }

  const handleToggleDebugger = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0]?.id
      if (!tabId) return

      chrome.runtime.sendMessage(
        { type: 'toggle-debugger', tabId },
        (response: StatusResponse) => {
          setStatus(response)
        },
      )
    })
  }

  const handleRemoveAlwaysLog = (host: string) => {
    chrome.runtime.sendMessage({ type: 'remove-always-log', host }, () => {
      refreshStatus()
    })
  }

  const handlePreview = () => {
    if (!hasData || !markdown) return
    chrome.runtime.sendMessage(
      { type: 'cache-preview', markdown },
      (response: { id: string }) => {
        if (response?.id) {
          chrome.tabs.create({
            url: chrome.runtime.getURL(`preview/preview.html?id=${response.id}`),
          })
        }
      },
    )
  }

  const isLoading = loadingStatus || loadingSettings || loadingData
  const isEnhanced = status?.mode === 'debugger'
  const showConsentView = status?.mode === 'inactive'

  return {
    // State
    status,
    isFirefox,
    isLoading,
    isEnhanced,
    showConsentView,
    currentHost,
    // Settings & filters
    settings,
    setSetting,
    localConsoleFilter,
    handleConsoleFilterChange,
    localNetworkFilter,
    handleNetworkFilterChange,
    // Data
    tokenCount,
    hasData,
    copyStatus,
    // Actions
    handleStartLogging,
    handleStopLogging,
    handleAlwaysLog,
    handleToggleDebugger,
    handleRemoveAlwaysLog,
    handlePreview,
    copyToClipboard,
  }
}
