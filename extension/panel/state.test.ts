import { describe, expect, it } from 'vitest'
import {
  createInitialState,
  extractPersistedSettings,
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  mergePersistedSettings,
  type PersistedLoggySettings,
} from './state'

const PERSISTED_KEYS: Array<keyof PersistedLoggySettings> = [
  'consoleFilter',
  'networkFilter',
  'consoleVisible',
  'networkVisible',
  'includeAgentContext',
  'includeResponseBodies',
  'truncateConsoleLogs',
  'redactSensitiveInfo',
  'networkExportEnabled',
  'autoServerSync',
  'serverUrl',
]

function createPersistedDefaults(): PersistedLoggySettings {
  return extractPersistedSettings(createInitialState())
}

describe('persisted settings contract', () => {
  it('exports the expected storage key constant', () => {
    expect(LOGGY_PANEL_SETTINGS_STORAGE_KEY).toBe('loggyPanelSettings')
  })
})

describe('extractPersistedSettings', () => {
  it('returns only the persisted settings', () => {
    const state = {
      ...createInitialState(),
      consoleFilter: 'error',
      networkFilter: '/api',
      selectedRoutes: ['/transient-route'],
      consoleVisible: false,
      networkVisible: false,
      includeAgentContext: false,
      includeResponseBodies: true,
      truncateConsoleLogs: false,
      serverUrl: 'http://custom:1234',
      serverConnected: true,
      consoleLogs: [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          level: 'log' as const,
          message: 'transient',
        },
      ],
      networkEntries: [
        {
          startedDateTime: '2024-01-01T00:00:00.000Z',
          request: { method: 'GET', url: '/transient-network' },
          response: { status: 200, statusText: 'OK' },
        },
      ],
    }

    const persisted = extractPersistedSettings(state)

    expect(Object.keys(persisted).sort()).toEqual([...PERSISTED_KEYS].sort())
    expect(persisted).toEqual({
      consoleFilter: 'error',
      networkFilter: '/api',
      consoleVisible: false,
      networkVisible: false,
      includeAgentContext: false,
      includeResponseBodies: true,
      truncateConsoleLogs: false,
      redactSensitiveInfo: true,
      networkExportEnabled: true,
      autoServerSync: false,
      serverUrl: 'http://custom:1234',
    })
  })
})

describe('mergePersistedSettings', () => {
  it('merges a valid stored payload into defaults', () => {
    const defaults = createPersistedDefaults()
    const stored = {
      consoleFilter: 'warn|error',
      networkFilter: '/v1',
      consoleVisible: false,
      networkVisible: false,
      includeAgentContext: false,
      includeResponseBodies: true,
      truncateConsoleLogs: false,
      redactSensitiveInfo: false,
      networkExportEnabled: false,
      autoServerSync: true,
      serverUrl: 'http://custom:1234',
    }

    expect(mergePersistedSettings(stored, defaults)).toEqual(stored)
  })

  it('falls back to defaults for malformed payloads', () => {
    const defaults = createPersistedDefaults()

    expect(mergePersistedSettings(null, defaults)).toEqual(defaults)
    expect(mergePersistedSettings('not-an-object', defaults)).toEqual(defaults)
    expect(mergePersistedSettings(['bad'], defaults)).toEqual(defaults)
  })

  it('falls back per-key when stored keys are missing or invalid', () => {
    const defaults = createPersistedDefaults()
    const merged = mergePersistedSettings(
      {
        consoleFilter: 'only-this-is-valid',
        networkFilter: 123,
        consoleVisible: 'nope',
        includeResponseBodies: true,
      },
      defaults
    )

    expect(merged).toEqual({
      ...defaults,
      consoleFilter: 'only-this-is-valid',
      includeResponseBodies: true,
    })
  })

  it('strips extra keys and never merges transient arrays', () => {
    const defaults = createPersistedDefaults()
    const merged = mergePersistedSettings(
      {
        consoleFilter: 'safe',
        selectedRoutes: ['/should-not-merge'],
        consoleLogs: [{ message: 'should-not-merge' }],
        networkEntries: [{ request: { url: '/should-not-merge' } }],
        arbitraryKey: 'ignored',
      },
      defaults
    )

    expect(Object.keys(merged).sort()).toEqual([...PERSISTED_KEYS].sort())
    expect(merged).toEqual({
      ...defaults,
      consoleFilter: 'safe',
    })
    expect(merged).not.toHaveProperty('selectedRoutes')
    expect(merged).not.toHaveProperty('consoleLogs')
    expect(merged).not.toHaveProperty('networkEntries')
  })
})
