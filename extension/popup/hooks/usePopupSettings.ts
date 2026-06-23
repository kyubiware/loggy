import { useCallback, useEffect, useRef, useState } from 'react'

import { browser } from '../../browser-apis'
import type { StorageChange } from '../../browser-apis/types'
import {
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  createDefaultSettings,
  createInitialState,
  extractPersistedSettings,
  mergePersistedSettings,
  type PersistedLoggySettings,
} from '../../types/state'

type SettingValue = string | boolean | number

/**
 * Reads and syncs persisted Loggy settings for the popup UI.
 *
 * Writes settings to storage immediately on every change (no debounce).
 * Extension popups are destroyed on close, so debounced writes would be
 * lost if the popup closes before the timeout fires.
 */
export function usePopupSettings(): {
  settings: PersistedLoggySettings
  setSetting: (key: keyof PersistedLoggySettings, value: SettingValue) => void
  loading: boolean
} {
  const defaultsRef = useRef<PersistedLoggySettings>(
    mergePersistedSettings(undefined, createDefaultSettings()),
  )
  const [settings, setSettings] = useState<PersistedLoggySettings>(defaultsRef.current)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const defaults = createDefaultSettings()
    defaultsRef.current = defaults

    ;(async () => {
      const result = await browser.storage.local.get<Record<string, unknown>>([LOGGY_PANEL_SETTINGS_STORAGE_KEY])
      const mergedSettings = mergePersistedSettings(
        result[LOGGY_PANEL_SETTINGS_STORAGE_KEY],
        defaults,
      )

      setSettings(extractPersistedSettings({ ...createInitialState(), ...mergedSettings }))
      setLoading(false)
    })()

    const handleStorageChange = async (
      changes: Record<string, StorageChange>,
      areaName: 'local' | 'session' | 'sync' | 'managed',
    ) => {
      if (areaName !== 'local' || !changes[LOGGY_PANEL_SETTINGS_STORAGE_KEY]) {
        return
      }

      const result = await browser.storage.local.get<Record<string, unknown>>([LOGGY_PANEL_SETTINGS_STORAGE_KEY])
      const mergedSettings = mergePersistedSettings(
        result[LOGGY_PANEL_SETTINGS_STORAGE_KEY],
        defaultsRef.current,
      )

      setSettings(extractPersistedSettings({ ...createInitialState(), ...mergedSettings }))
    }

    browser.storage.onChanged.addListener(handleStorageChange)

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange)
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

        browser.storage.local.set({
          [LOGGY_PANEL_SETTINGS_STORAGE_KEY]: persistedSettings,
        })

        return updatedSettings
      })
    },
    [],
  )

  return { settings, setSetting, loading }
}
