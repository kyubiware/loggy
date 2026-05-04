import { Globe, Terminal } from 'lucide-react'

import { ConsentView, StopLoggingButton } from './components/ConsentView'
import { EnhancedCaptureToggle } from './components/EnhancedCaptureToggle'
import {
  ExportOptionCheckboxes,
  type ToggleSettingKey,
} from './components/ExportOptionCheckboxes'
import { FilterInput } from './components/FilterInput'
import { PopupHeader } from './components/PopupHeader'
import { ServerConnection } from './components/ServerConnection'
import { SettingsAccordion } from './components/SettingsAccordion'
import { TokenCountAndCopy } from './components/TokenCountAndCopy'
import { AlwaysLogHosts } from './components/AlwaysLogHosts'
import { usePopupActions } from './hooks/usePopupActions'

export default function Popup() {
  const {
    status,
    isFirefox,
    isLoading,
    isEnhanced,
    showConsentView,
    currentHost,
    settings,
    setSetting,
    localConsoleFilter,
    handleConsoleFilterChange,
    localNetworkFilter,
    handleNetworkFilterChange,
    serverConnected,
    handleServerUrlChange,
    handleRetryConnection,
    tokenCount,
    hasData,
    copyStatus,
    handleStartLogging,
    handleStopLogging,
    handleAlwaysLog,
    handleToggleDebugger,
    handleRemoveAlwaysLog,
    handlePreview,
    copyToClipboard,
  } = usePopupActions()

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

  return (
    <div className='p-4 flex flex-col gap-4 text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-900 min-h-[200px] max-sm:min-h-[100dvh] max-sm:flex-1 max-sm:overflow-y-auto w-80'>
      <PopupHeader connected={status.connected} />

      {showConsentView ? (
        <ConsentView
          host={currentHost}
          onStartLogging={handleStartLogging}
          onAlwaysLog={handleAlwaysLog}
        />
      ) : (
        <>
          <SettingsAccordion
            defaultOpen={settings.settingsAccordionOpen}
            onToggle={() => setSetting('settingsAccordionOpen', !settings.settingsAccordionOpen)}
          >
            <ExportOptionCheckboxes
              settings={settings}
              onToggle={(key: ToggleSettingKey) => setSetting(key, !settings[key])}
            />
            {settings.networkExportEnabled && (
              <ServerConnection
                serverUrl={settings.serverUrl}
                onServerUrlChange={handleServerUrlChange}
                serverConnected={serverConnected}
                onRetry={handleRetryConnection}
              />
            )}

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
          </SettingsAccordion>
          <TokenCountAndCopy
            hasData={hasData}
            tokenCount={tokenCount}
            copyStatus={copyStatus}
            onCopy={copyToClipboard}
            onPreview={handlePreview}
          />
        </>
      )}

      {!isFirefox && (
        <EnhancedCaptureToggle
          isEnhanced={isEnhanced}
          onToggle={handleToggleDebugger}
        />
      )}
      {!showConsentView && status.mode !== 'devtools' && (
        <StopLoggingButton onStop={handleStopLogging} />
      )}
      <AlwaysLogHosts onRemove={handleRemoveAlwaysLog} />
    </div>
  )
}
