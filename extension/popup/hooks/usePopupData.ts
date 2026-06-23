import { useCallback, useEffect, useMemo, useState } from 'react'

import { browser } from '../../browser-apis'
import type { GetTabExportDataMessage, TabExportDataResponse } from '../../types/messages'
import type { PersistedLoggySettings } from '../../types/state'

type PopupDataState = TabExportDataResponse

const POLL_INTERVAL_MS = 2000

const createDefaultPopupData = (): PopupDataState => ({
  tokenCount: 0,
  markdown: '',
  hasData: false,
  logCount: 0,
  routeOptions: [],
})

/**
 * Settings keys whose values influence the generated Markdown export.
 *
 * Only these trigger a background re-fetch when changed. Pure-UI settings
 * (accordion expansion, server URL typing, server-sync flags) are deliberately
 * excluded so they don't cause wasteful round-trips — notably the server URL
 * field is undebounced, so including it would fire a fetch per keystroke.
 */
const EXPORT_RELEVANT_SETTING_KEYS = [
  'consoleFilter',
  'networkFilter',
  'consoleVisible',
  'networkVisible',
  'includeAgentContext',
  'includeResponseBodies',
  'truncateConsoleLogs',
  'responseBodyMode',
  'deduplicateApiCalls',
  'redactSensitiveInfo',
  'maxTokenLimit',
] as const satisfies ReadonlyArray<keyof PersistedLoggySettings>

/**
 * Reads exported tab data for the active browser tab.
 */
export function usePopupData(
  tabId?: number,
  selectedRoutes?: string[],
  routesFilterEnabled?: boolean,
  settings?: PersistedLoggySettings,
): PopupDataState & {
  loading: boolean
  refresh: () => void
} {
  const [data, setData] = useState<PopupDataState>(createDefaultPopupData)
  const [loading, setLoading] = useState(true)
  const [debouncedRoutes, setDebouncedRoutes] = useState<string[] | undefined>(selectedRoutes)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedRoutes(selectedRoutes), 300)
    return () => clearTimeout(timer)
  }, [selectedRoutes])

  /**
   * Stable fingerprint of only the markdown-relevant settings. The `useMemo`
   * dep is the full `settings` object (whose identity changes on ANY setting
   * edit), but the serialized output only changes when an export-relevant
   * value actually differs — so non-export edits (server URL, accordions)
   * produce an identical string and skip the re-fetch.
   */
  const settingsFingerprint = useMemo(() => {
    if (!settings) return ''
    return JSON.stringify(EXPORT_RELEVANT_SETTING_KEYS.map((key) => settings[key]))
  }, [settings])

  // NOTE: We intentionally do NOT call `setLoading(true)` here. The initial
  // `useState(true)` already covers the first load, and flipping loading back
  // to true on subsequent refreshes (filter/route changes) would unmount the
  // entire Popup content tree via the `if (isLoading)` gate in Popup.tsx —
  // destroying scroll position. See usePopupData.test.ts "preserves scroll"
  // regression test.
  const refresh = useCallback(() => {
    // Wrapped in setTimeout(0) so the async work starts inside a timer
    // callback. This ensures tests using vi.useFakeTimers + vi.runAllTimers
    // can flush the resulting microtasks (sinonjs fake-timers processes
    // microtasks queued by timer callbacks).
    setTimeout(async () => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true })
      const id = tabs[0]?.id

      if (!id) {
        setData(createDefaultPopupData())
        setLoading(false)
        return
      }

      const message: GetTabExportDataMessage = {
        type: 'get-tab-export-data',
        tabId: id,
        selectedRoutes: debouncedRoutes,
        routesFilterEnabled,
      }

      try {
        const response = await browser.runtime.sendMessage<TabExportDataResponse>(message)
        setData({
          tokenCount: response.tokenCount,
          markdown: response.markdown,
          hasData: response.hasData,
          logCount: response.logCount,
          routeOptions: response.routeOptions,
        })
      } catch {
        setData(createDefaultPopupData())
      }
      setLoading(false)
    }, 0)
  }, [debouncedRoutes, routesFilterEnabled, settingsFingerprint])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const interval = setInterval(() => {
      refresh()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return { ...data, loading, refresh }
}
