import { useCallback, useEffect, useRef, useState } from 'react'

import { buildExportMarkdown } from '../../shared/export'
import { getFilteredPanelData } from '../../utils/filtered-data'
import {
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  createInitialState,
  extractPersistedSettings,
  mergePersistedSettings,
  type LoggyState,
} from '../../types/state'
import type { ConsoleMessage } from '../../types/console'
import type { HAREntry } from '../../types/har'
import type { CaptureMode } from '../../types/messages'
import { estimateTokenCount } from '../../utils/token-estimate'

const POLL_INTERVAL_MS = 2000

interface RawBufferData {
  consoleLogs: Array<{ timestamp: string; level: string; message: string }>
  networkLogs: Array<{
    timestamp: string
    url: string
    method: string
    status: number
    responseBodyPreview?: string
    contentType?: string
    duration?: number
  }>
}

type FirefoxDirectCaptureState = {
  tokenCount: number
  markdown: string
  hasData: boolean
  logCount: number
}

const createDefaultData = (): FirefoxDirectCaptureState => ({
  tokenCount: 0,
  markdown: '',
  hasData: false,
  logCount: 0,
})

function toHAREntry(entry: RawBufferData['networkLogs'][number]): HAREntry {
  return {
    startedDateTime: entry.timestamp,
    time: entry.duration,
    request: {
      url: entry.url,
      method: entry.method,
    },
    response: {
      status: entry.status,
      statusText: '',
      content:
        typeof entry.responseBodyPreview === 'string' || typeof entry.contentType === 'string'
          ? {
              text: entry.responseBodyPreview,
              mimeType: entry.contentType,
            }
          : undefined,
    },
  }
}

export function useFirefoxDirectCapture(tabId: number): {
  tokenCount: number
  markdown: string
  hasData: boolean
  logCount: number
  loading: boolean
  refresh: () => void
} {
  const [data, setData] = useState<FirefoxDirectCaptureState>(createDefaultData)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const captureData = useCallback(async (): Promise<void> => {
    try {
      const status: { mode: CaptureMode } = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'get-status' }, (response: unknown) => {
          if (chrome.runtime.lastError || typeof response !== 'object' || response === null) {
            resolve({ mode: 'inactive' })
            return
          }

          const { mode } = response as { mode?: CaptureMode }
          resolve({ mode: mode ?? 'inactive' })
        })
      })

      if (status.mode === 'inactive') {
        setData(createDefaultData())
        setLoading(false)
        return
      }

      const scriptResults = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN' as any,
        func: () => ({
          consoleLogs: (window as any).__loggyConsoleLogs || [],
          networkLogs: (window as any).__loggyNetworkLogs || [],
        }),
      })

      const rawResult = scriptResults[0]?.result as RawBufferData | undefined
      if (!rawResult) {
        setData(createDefaultData())
        return
      }

      const consoleLogs: ConsoleMessage[] = Array.isArray(rawResult.consoleLogs)
        ? (rawResult.consoleLogs as ConsoleMessage[])
        : []
      const networkEntries: HAREntry[] = Array.isArray(rawResult.networkLogs)
        ? rawResult.networkLogs.map((entry) => toHAREntry(entry))
        : []

      const defaults = createInitialState()
      const persistedDefaults = extractPersistedSettings(defaults)
      const settingsResult = (await chrome.storage.local.get(LOGGY_PANEL_SETTINGS_STORAGE_KEY)) as Record<
        string,
        unknown
      >

      const persistedSettings = mergePersistedSettings(
        settingsResult[LOGGY_PANEL_SETTINGS_STORAGE_KEY],
        persistedDefaults
      )

      const state: LoggyState = {
        ...defaults,
        ...persistedSettings,
        consoleLogs,
        networkEntries,
      }

      const filteredData = getFilteredPanelData(state)
      const markdown = await buildExportMarkdown(state)
      const tokenCount = estimateTokenCount(markdown)

      setData({
        tokenCount,
        markdown,
        hasData: filteredData.consoleLogs.length > 0 || filteredData.networkEntries.length > 0,
        logCount: filteredData.consoleLogs.length + filteredData.networkEntries.length,
      })
    } catch (_error) {
      setData(createDefaultData())
    } finally {
      setLoading(false)
    }
  }, [tabId])

  const refresh = useCallback(() => {
    setLoading(true)
    void captureData()
  }, [captureData])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    timerRef.current = setInterval(() => {
      void captureData()
    }, POLL_INTERVAL_MS)

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [captureData])

  return { ...data, loading, refresh }
}
