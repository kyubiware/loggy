declare const __BROWSER__: string

import { useCallback, useEffect, useRef, useState } from 'react'

import { browser } from '../../browser-apis'
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
    setIsFirefox(__BROWSER__ === 'firefox')

    ;(async () => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      const id = tabs[0]?.id
      const url = tabs[0]?.url ?? ''
      setTabId(id)
      setTabUrl(url)
      if (!id) {
        setLoadingStatus(false)
        return
      }

      try {
        const response = await browser.runtime.sendMessage<StatusResponse>({ type: 'get-status' })
        debugLog('message', 'popup', 'get-status response', {
          mode: response?.mode,
          tabId: response?.tabId,
          logCount: response?.logCount,
          connected: response?.connected,
        })
        setStatus(response)
      } catch {
        // Background worker not reachable — popup may have closed
      }
      setLoadingStatus(false)
    })()
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

  const refreshStatus = useCallback(async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const id = tabs[0]?.id
    if (!id) return
    try {
      const response = await browser.runtime.sendMessage<StatusResponse>({ type: 'get-status' })
      debugLog('message', 'popup', 'get-status response (refresh)', {
        mode: response?.mode,
        tabId: response?.tabId,
        logCount: response?.logCount,
        connected: response?.connected,
      })
      setStatus(response)
    } catch {
      // Refresh failed — background worker may be unavailable
    }
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

  const handleToggleDebugger = async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    const id = tabs[0]?.id
    if (!id) return

    try {
      const response = await browser.runtime.sendMessage<StatusResponse>({ type: 'toggle-debugger', tabId: id })
      debugLog('message', 'popup', 'toggle-debugger response', {
        newMode: response?.mode,
        tabId: id,
        connected: response?.connected,
      })
      setStatus(response)
    } catch {
      // Toggle failed
    }
  }

  const handleClearLogs = async () => {
    if (!tabId) return
    try {
      await browser.runtime.sendMessage({ type: 'clear-tab-data', tabId })
      refreshStatus()
      refreshData()
    } catch {
      // Clear failed
    }
  }

  const handlePreview = async () => {
    if (!hasData || !markdown) return
    try {
      const response = await browser.runtime.sendMessage<{ id: string }>({ type: 'cache-preview', markdown })
      if (response?.id) {
        await browser.tabs.create({
          url: browser.runtime.getURL(`preview/preview.html?id=${response.id}`),
        })
      }
    } catch {
      // Preview failed
    }
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

  // Firefox lacks the debugger API, so the header Play/Pause toggle
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
