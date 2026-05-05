import { useCallback, useEffect, useRef, useState } from 'react'

import {
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  createInitialState,
  extractPersistedSettings,
  mergePersistedSettings,
  type PersistedLoggySettings,
} from '../../types/state'

type SettingValue = string | boolean | number

/**
 * Reads and syncs persisted Loggy settings for the popup UI.
 */
export function usePopupSettings(): {
  settings: PersistedLoggySettings
  setSetting: (key: keyof PersistedLoggySettings, value: SettingValue) => void
  loading: boolean
} {
  const defaultsRef = useRef<PersistedLoggySettings>(
    mergePersistedSettings(undefined, extractDefaults()),
  )
  const writeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [settings, setSettings] = useState<PersistedLoggySettings>(defaultsRef.current)
  const [loading, setLoading] = useState(true)

  function extractDefaults(): PersistedLoggySettings {
    const defaults = createInitialState()

    return {
      consoleFilter: defaults.consoleFilter,
      networkFilter: defaults.networkFilter,
      consoleVisible: defaults.consoleVisible,
      networkVisible: defaults.networkVisible,
      includeAgentContext: defaults.includeAgentContext,
      includeResponseBodies: defaults.includeResponseBodies,
      truncateConsoleLogs: defaults.truncateConsoleLogs,
      redactSensitiveInfo: defaults.redactSensitiveInfo,
      networkExportEnabled: defaults.networkExportEnabled,
      autoServerSync: defaults.autoServerSync,
      serverUrl: defaults.serverUrl,
      settingsAccordionOpen: defaults.settingsAccordionOpen,
      maxTokenLimit: defaults.maxTokenLimit,
    }
  }

  useEffect(() => {
    const defaults = extractDefaults()
    defaultsRef.current = defaults

    chrome.storage.local.get([LOGGY_PANEL_SETTINGS_STORAGE_KEY], (result) => {
      const mergedSettings = mergePersistedSettings(
        result[LOGGY_PANEL_SETTINGS_STORAGE_KEY],
        defaults,
      )

      setSettings(extractPersistedSettings({ ...createInitialState(), ...mergedSettings }))
      setLoading(false)
    })

    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local' || !changes[LOGGY_PANEL_SETTINGS_STORAGE_KEY]) {
        return
      }

      chrome.storage.local.get([LOGGY_PANEL_SETTINGS_STORAGE_KEY], (result) => {
        const mergedSettings = mergePersistedSettings(
          result[LOGGY_PANEL_SETTINGS_STORAGE_KEY],
          defaultsRef.current,
        )

        setSettings(extractPersistedSettings({ ...createInitialState(), ...mergedSettings }))
      })
    }

    chrome.storage.onChanged.addListener(handleStorageChange)

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange)

      if (writeTimeoutRef.current !== null) {
        clearTimeout(writeTimeoutRef.current)
        writeTimeoutRef.current = null
      }
    }
  }, [])

  const setSetting = useCallback(
    (key: keyof PersistedLoggySettings, value: SettingValue) => {
      setSettings((currentSettings) => {
        const updatedSettings = { ...currentSettings, [key]: value }
        const persistedSettings = extractPersistedSettings({
          ...createInitialState(),
          ...updatedSettings,
        })

        if (writeTimeoutRef.current !== null) {
          clearTimeout(writeTimeoutRef.current)
        }

        writeTimeoutRef.current = setTimeout(() => {
          chrome.storage.local.set({
            [LOGGY_PANEL_SETTINGS_STORAGE_KEY]: persistedSettings,
          })
        }, 300)

        return updatedSettings
      })
    },
    [],
  )

  return { settings, setSetting, loading }
}
