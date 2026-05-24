import { useMemo } from 'react'
import { createInitialState, type LoggyState } from '../../../types/state'
import { type FilteredPanelData, getFilteredPanelData } from '../../../utils/filtered-data'
import { estimateTokenCount } from '../../../utils/token-estimate'
import { buildPreviewText, buildStatsText } from '../../preview'
import { useLogData, useSettings } from '../LoggyContext'
import type { LogDataContextValue, SettingsContextValue } from '../LoggyContext.types'

export interface FilteredDataResult {
  filteredData: FilteredPanelData
  previewText: string
  statsText: string
  tokenEstimate: number
}

function buildPseudoState(
  logData: LogDataContextValue,
  settings: SettingsContextValue
): LoggyState {
  return {
    ...createInitialState(),
    consoleLogs: logData.consoleLogs,
    networkEntries: logData.networkEntries,
    consoleFilter: settings.consoleFilter,
    networkFilter: settings.networkFilter,
    selectedRoutes: logData.selectedRoutes,
    consoleVisible: settings.consoleVisible,
    networkVisible: settings.networkVisible,
    includeAgentContext: settings.includeAgentContext,
    includeResponseBodies: settings.includeResponseBodies,
    truncateConsoleLogs: settings.truncateConsoleLogs,
    truncateResponseBodies: settings.truncateResponseBodies,
    redactSensitiveInfo: settings.redactSensitiveInfo,
    networkExportEnabled: settings.networkExportEnabled,
    autoServerSync: settings.autoServerSync,
    serverSyncError: settings.serverSyncError,
    maxTokenLimit: settings.maxTokenLimit,
    deduplicateApiCalls: settings.deduplicateApiCalls,
    preserveLogs: settings.preserveLogs,
    serverUrl: '',
  }
}

export function useFilteredData(): FilteredDataResult {
  const logData = useLogData()
  const settings = useSettings()

  return useMemo(() => {
    const pseudoState = buildPseudoState(logData, settings)
    const filteredData = getFilteredPanelData(pseudoState)
    const previewText = buildPreviewText(filteredData)
    const statsText = buildStatsText(filteredData)
    const tokenEstimate = estimateTokenCount(previewText)
    return { filteredData, previewText, statsText, tokenEstimate }
  }, [logData, settings])
}
