import { useCallback, useEffect, useRef, useState } from 'react'

import { probeServer } from '../../panel/server-probe'
import { useRouteActions } from '../../shared/hooks/useRouteActions'
import { useConsentActions } from '../../shared/hooks/useConsentActions'
import { useDebouncedFilter } from '../../shared/hooks/useDebouncedFilter'
import type { StatusResponse } from '../../types/messages'
import { debugLog } from '../../utils/debug-logger'
import { computeIsLoggingActive } from './isLoggingActive'
import { usePopupData } from './usePopupData'
import { usePopupExport } from './usePopupExport'
import { usePopupSettings } from './usePopupSettings'

export function usePopupActions() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [isFirefox, setIsFirefox] = useState(false)
  const [tabId, setTabId] = useState<number | undefined>(undefined)
  const [tabUrl, setTabUrl] = useState<string>('')
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([])
  const [routesFilterEnabled, setRoutesFilterEnabled] = useState(false)

  const { settings, setSetting, loading: loadingSettings } = usePopupSettings()
  const {
    tokenCount,
    markdown,
    hasData,
    routeOptions,
    loading: loadingData,
    refresh: refreshData,
  } = usePopupData(tabId, selectedRoutes, routesFilterEnabled, settings)
  const [serverConnected, setServerConnected] = useState(false)
  const serverPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastProbedUrlRef = useRef<string | null>(null)
  const { copyToClipboard, copyStatus } = usePopupExport({ markdown, hasData, serverConnected, serverUrl: settings.serverUrl })

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

  const probeConfiguredServer = useCallback(async (url: string): Promise<void> => {
    const connected = await probeServer(url)
    setServerConnected(connected)
  }, [])

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
          debugLog('message', 'popup', 'get-status response', {
            mode: response?.mode,
            tabId: response?.tabId,
            logCount: response?.logCount,
            connected: response?.connected,
          })
          setStatus(response)
          setLoadingStatus(false)
        },
      )
    })
  }, [])

  // Probe server when network export is enabled or URL changes
  useEffect(() => {
    if (!settings.networkExportEnabled) {
      setServerConnected(false)
      if (serverPollRef.current !== null) {
        clearInterval(serverPollRef.current)
        serverPollRef.current = null
      }
      return
    }

    if (lastProbedUrlRef.current !== settings.serverUrl) {
      lastProbedUrlRef.current = settings.serverUrl
      void probeConfiguredServer(settings.serverUrl)
    }

    if (serverPollRef.current === null) {
      serverPollRef.current = setInterval(() => {
        void probeConfiguredServer(settings.serverUrl)
      }, 5000)
    }

    return () => {
      if (serverPollRef.current !== null) {
        clearInterval(serverPollRef.current)
        serverPollRef.current = null
      }
    }
  }, [settings.networkExportEnabled, settings.serverUrl, probeConfiguredServer])

  const currentHost = (() => {
    try {
      return new URL(tabUrl).hostname
    } catch {
      return ''
    }
  })()

  const refreshStatus = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0]?.id
      if (!tabId) return
      chrome.runtime.sendMessage(
        { type: 'get-status' },
        (response: StatusResponse) => {
          debugLog('message', 'popup', 'get-status response (refresh)', {
            mode: response?.mode,
            tabId: response?.tabId,
            logCount: response?.logCount,
            connected: response?.connected,
          })
          setStatus(response)
        },
      )
    })
  }, [])

  const { handleStartLogging, handleStopLogging, handleAlwaysLog } = useConsentActions({
    tabId,
    host: currentHost,
    onStateChanged: refreshStatus,
  })

  const { toggleRoute, selectAllRoutes, deselectAllRoutes, toggleRoutes } = useRouteActions({
    setSelectedRoutes,
    setRoutesFilterEnabled,
    routeOptions,
    autoIncludeRoutes: settings.autoIncludeRoutes,
  })

  const handleToggleDebugger = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      const tabId = tabs[0]?.id
      if (!tabId) return

      chrome.runtime.sendMessage(
        { type: 'toggle-debugger', tabId },
        (response: StatusResponse) => {
          debugLog('message', 'popup', 'toggle-debugger response', {
            newMode: response?.mode,
            tabId,
            connected: response?.connected,
          })
          setStatus(response)
        },
      )
    })
  }

  const handleClearLogs = () => {
    if (!tabId) return
    chrome.runtime.sendMessage(
      { type: 'clear-tab-data', tabId },
      () => {
        refreshStatus()
        refreshData()
      },
    )
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

  const handleRetryConnection = () => {
    void probeConfiguredServer(settings.serverUrl)
  }

  const handleServerUrlChange = (url: string) => {
    setSetting('serverUrl', url)
  }

  const isLoading = loadingStatus || loadingSettings || loadingData
  const isLoggingActive = computeIsLoggingActive(status, isFirefox)
  const showConsentView = status?.mode === 'inactive'

  // Firefox lacks chrome.debugger, so the header Play/Pause toggle
  // routes through the consent-based start/stop flow instead of the
  // Chrome-only toggle-debugger path.
  const handleToggleLogging = () => {
    if (isFirefox) {
      if (isLoggingActive) {
        handleStopLogging()
      } else {
        handleStartLogging()
      }
      return
    }
    handleToggleDebugger()
  }

  return {
    // State
    status,
    isFirefox,
    isLoading,
    isLoggingActive,
    showConsentView,
    currentHost,
    // Settings & filters
    settings,
    setSetting,
    localConsoleFilter,
    handleConsoleFilterChange,
    localNetworkFilter,
    handleNetworkFilterChange,
    // Server connection
    serverConnected,
    handleServerUrlChange,
    handleRetryConnection,
    // Data
    markdown,
    tokenCount,
    hasData,
    copyStatus,
    // Routes
    routeOptions,
    selectedRoutes,
    toggleRoute,
    toggleRoutes,
    selectAllRoutes,
    deselectAllRoutes,
    // Actions
    handleStartLogging,
    handleStopLogging,
    handleClearLogs,
    handleAlwaysLog,
    handleToggleLogging,
    handlePreview,
    copyToClipboard,
  }
}
