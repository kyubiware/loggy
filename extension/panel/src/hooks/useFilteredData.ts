import { useMemo } from 'react'
import type { LoggyState } from '../../../types/state'
import { type FilteredPanelData, getFilteredPanelData } from '../../../utils/filtered-data'
import { estimateTokenCount } from '../../../utils/token-estimate'
import { buildPreviewText, buildStatsText } from '../../preview'
import { useLogData, useSettings } from '../LoggyContext'

export interface FilteredDataResult {
  filteredData: FilteredPanelData
  previewText: string
  statsText: string
  tokenEstimate: number
}

export function useFilteredData(): FilteredDataResult {
  const logData = useLogData()
  const settings = useSettings()

  return useMemo(() => {
    // Reconstruct enough of LoggyState to satisfy getFilteredPanelData
    const pseudoState: LoggyState = {
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
      redactSensitiveInfo: settings.redactSensitiveInfo,
      networkExportEnabled: settings.networkExportEnabled,
      autoServerSync: settings.autoServerSync,
      serverSyncError: settings.serverSyncError,
      settingsAccordionOpen: true,
      serverUrl: '',
      serverConnected: false,
    }

    const filteredData = getFilteredPanelData(pseudoState)
    const previewText = buildPreviewText(filteredData)
    const statsText = buildStatsText(filteredData)
    const tokenEstimate = estimateTokenCount(previewText)

    return {
      filteredData,
      previewText,
      statsText,
      tokenEstimate,
    }
  }, [
    logData.consoleLogs,
    logData.networkEntries,
    logData.selectedRoutes,
    settings.consoleFilter,
    settings.networkFilter,
    settings.consoleVisible,
    settings.networkVisible,
    settings.includeAgentContext,
    settings.includeResponseBodies,
    settings.truncateConsoleLogs,
    settings.redactSensitiveInfo,
    settings.networkExportEnabled,
    settings.autoServerSync,
    settings.serverSyncError,
  ])
}
