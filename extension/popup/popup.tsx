import { Globe, Terminal } from 'lucide-react'
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import { useDebouncedFilter } from '../panel/src/components/controls/useDebouncedFilter'
import type { StatusResponse } from '../types/messages'
import { CaptureModeDisplay } from './components/CaptureModeDisplay'
import { EnhancedCaptureToggle } from './components/EnhancedCaptureToggle'
import { ExportOptionToggles } from './components/ExportOptionToggles'
import { FilterInput } from './components/FilterInput'
import { PopupHeader } from './components/PopupHeader'
import { TokenCountAndCopy } from './components/TokenCountAndCopy'
import { usePopupData } from './hooks/usePopupData'
import { usePopupExport } from './hooks/usePopupExport'
import { usePopupSettings } from './hooks/usePopupSettings'
import './index.css'

function Popup() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [isFirefox, setIsFirefox] = useState(false)

  const { settings, setSetting, loading: loadingSettings } = usePopupSettings()
  const { tokenCount, markdown, hasData, loading: loadingData } = usePopupData()
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

  const isLoading = loadingStatus || loadingSettings || loadingData

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-48 w-80 text-stone-500'>
        Loading...
      </div>
    )
  }

  if (!status) {
    return (
      <div className='flex justify-center items-center h-48 w-80 text-stone-500'>
        No active tab found.
      </div>
    )
  }

  const isEnhanced = status.mode === 'debugger'

  return (
    <div className='p-4 flex flex-col gap-4 text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-900 min-h-[200px] w-80'>
      <PopupHeader connected={status.connected} />
      <CaptureModeDisplay mode={status.mode} logCount={status.logCount} />
      <ExportOptionToggles
        settings={settings}
        onToggle={(key) => setSetting(key, !settings[key])}
      />

      <div className='flex flex-col gap-2'>
        <FilterInput
          icon={<Terminal size={14} />}
          iconTitle='Console Filter'
          placeholder='Filter console (regex)...'
          value={localConsoleFilter}
          onChange={handleConsoleFilterChange}
          visible={settings.consoleVisible}
          onToggleVisibility={() =>
            setSetting('consoleVisible', !settings.consoleVisible)
          }
          visibleLabel='Hide Console Filter'
          hiddenLabel='Show Console Filter'
        />
        <FilterInput
          icon={<Globe size={14} />}
          iconTitle='Network Filter'
          placeholder='Filter network (e.g. -google)...'
          value={localNetworkFilter}
          onChange={handleNetworkFilterChange}
          visible={settings.networkVisible}
          onToggleVisibility={() =>
            setSetting('networkVisible', !settings.networkVisible)
          }
          visibleLabel='Hide Network Filter'
          hiddenLabel='Show Network Filter'
        />
      </div>
      <TokenCountAndCopy
        hasData={hasData}
        tokenCount={tokenCount}
        copyStatus={copyStatus}
        onCopy={copyToClipboard}
      />
      {!isFirefox && (
        <EnhancedCaptureToggle
          isEnhanced={isEnhanced}
          onToggle={handleToggleDebugger}
        />
      )}
    </div>
  )
}

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <Popup />
    </StrictMode>,
  )
}
