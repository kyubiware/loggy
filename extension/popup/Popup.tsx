import { Globe, Terminal } from 'lucide-react'

import { ConsentView } from '../shared/components/ConsentView'
import {
  ExportOptionCheckboxes,
  ResponseBodyModeSelect,
  TRUNCATE_CONFIGS,
  type ToggleSettingKey,
} from './components/ExportOptionCheckboxes'
import { FilterInput } from './components/FilterInput'
import { FiltersAccordion } from './components/FiltersAccordion'
import { PopupHeader } from './components/PopupHeader'
import { RoutesList } from './components/RoutesList'
import { ServerConnection } from './components/ServerConnection'
import { SettingsAccordion } from './components/SettingsAccordion'
import { TokenCountAndCopy } from './components/TokenCountAndCopy'
import { OptionCheckbox } from '../shared/components/OptionCheckbox'
import { usePopupActions } from './hooks/usePopupActions'

export default function Popup() {
  const {
    status,
    isLoading,
    isLoggingActive,
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
    markdown,
    tokenCount,
    hasData,
    copyStatus,
    routeOptions,
    selectedRoutes,
    toggleRoute,
    toggleRoutes,
    selectAllRoutes,
    deselectAllRoutes,
    handleStartLogging,
    handleStopLogging,
    handleClearLogs,
    handleAlwaysLog,
    handleToggleLogging,
    handlePreview,
    copyToClipboard,
  } = usePopupActions()

  if (isLoading) {
    return (
      <div className='flex justify-center items-center h-48 w-80 max-sm:w-full text-stone-500'>
        Loading...
      </div>
    )
  }

  if (!status) {
    return (
      <div className='flex justify-center items-center h-48 w-80 max-sm:w-full text-stone-500'>
        No active tab found.
      </div>
    )
  }

  return (
    <div className='p-4 flex flex-col gap-4 text-stone-800 dark:text-stone-200 bg-white dark:bg-stone-900 min-h-50 w-80'>
      {!showConsentView && (
        <PopupHeader
          connected={status.connected}
          copyStatus={copyStatus}
          onCopy={copyToClipboard}
          hasData={hasData}
          tokenCount={tokenCount}
          onClear={handleClearLogs}
          showLoggingToggle
          isLoggingActive={isLoggingActive}
          isDevtoolsMode={status.mode === 'devtools'}
          onToggleLogging={handleToggleLogging}
          onStopLogging={status.mode !== 'devtools' ? handleStopLogging : undefined}
        />
      )}

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
            onToggle={() =>
              setSetting(
                'settingsAccordionOpen',
                !settings.settingsAccordionOpen,
              )
            }
            settings={settings}
            onToggleSetting={(key: ToggleSettingKey) =>
              setSetting(key, !settings[key])
            }
          >
            <ExportOptionCheckboxes
              settings={settings}
              onToggle={(key: ToggleSettingKey) =>
                setSetting(key, !settings[key])
              }
              onSetTokenLimit={value => setSetting('maxTokenLimit', value)}
            />
            {settings.networkExportEnabled && (
              <ServerConnection
                serverUrl={settings.serverUrl}
                onServerUrlChange={handleServerUrlChange}
                serverConnected={serverConnected}
                onRetry={handleRetryConnection}
              />
            )}
          </SettingsAccordion>
          <FiltersAccordion
            defaultOpen={settings.filtersAccordionOpen}
            onToggle={() =>
              setSetting('filtersAccordionOpen', !settings.filtersAccordionOpen)
            }
            settings={settings}
            onToggleSetting={(key: ToggleSettingKey) =>
              setSetting(key, !settings[key])
            }
          >
            <div className='flex flex-col gap-2'>
              {TRUNCATE_CONFIGS.map(([key, label, icon]) => (
                <OptionCheckbox
                  key={key}
                  testId={key}
                  label={label}
                  icon={icon}
                  checked={settings[key]}
                  onChange={() => setSetting(key, !settings[key])}
                />
              ))}
              <ResponseBodyModeSelect
                value={settings.responseBodyMode}
                onChange={(value) => setSetting('responseBodyMode', value)}
              />
            </div>
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
            {routeOptions.length > 0 && (
              <RoutesList
                routeOptions={routeOptions}
                selectedRoutes={selectedRoutes}
                onToggleRoute={toggleRoute}
                onToggleRoutes={toggleRoutes}
                onSelectAll={selectAllRoutes}
                onDeselectAll={deselectAllRoutes}
                autoIncludeRoutes={settings.autoIncludeRoutes}
                onToggleAutoIncludeRoutes={() => setSetting('autoIncludeRoutes', !settings.autoIncludeRoutes)}
              />
            )}
          </FiltersAccordion>
          <TokenCountAndCopy
            hasData={hasData}
            markdown={markdown}
            onPreview={handlePreview}
          />
        </>
      )}

    </div>
  )
}
