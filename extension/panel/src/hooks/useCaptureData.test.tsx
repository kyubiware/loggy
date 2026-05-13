import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as serverExport from '../../../shared/server-export'
import type { ConsoleMessage } from '../../../types/console'
import type { HAREntry } from '../../../types/har'
import {
  createInitialState,
  LOGGY_PANEL_SETTINGS_STORAGE_KEY,
  type PersistedLoggySettings,
} from '../../../types/state'
import { getStorage, mockChromeStorageSet, resetStorage, seedStorage } from '../../../vitest.setup'
import * as capture from '../../capture'
import * as serverProbe from '../../server-probe'
import { reducer, useCaptureData } from './useCaptureData'

// Mock the capture module
vi.mock('../../capture', () => ({
  captureNetworkEntries: vi.fn(),
  captureConsoleLogs: vi.fn(),
  clearCapturedConsoleLogs: vi.fn(),
  clearResponseBodies: vi.fn(),
  enrichWithResponseBodies: vi.fn((entries: HAREntry[]) => entries),
  startResponseBodyCapture: vi.fn(),
  stopResponseBodyCapture: vi.fn(),
}))

vi.mock('../../server-probe', () => ({
  probeServer: vi.fn(),
}))

vi.mock('../../../shared/server-export', () => ({
  pushToServer: vi.fn().mockResolvedValue(true),
}))

const mockCaptureNetwork = vi.mocked(capture.captureNetworkEntries)
const mockCaptureConsole = vi.mocked(capture.captureConsoleLogs)
const mockClearCapturedConsoleLogs = vi.mocked(capture.clearCapturedConsoleLogs)
const mockProbeServer = vi.mocked(serverProbe.probeServer)
const mockPushToServer = vi.mocked(serverExport.pushToServer)

// Store navigation listener so we can call it manually
let navigationListener: (() => void) | null = null
const mockOnNavigated = {
  addListener: vi.fn((listener: () => void) => {
    navigationListener = listener
  }),
  removeListener: vi.fn(() => {
    navigationListener = null
  }),
}

const sampleConsoleLog: ConsoleMessage = {
  timestamp: '2024-01-01T00:00:00.000Z',
  level: 'log',
  message: 'test message',
}

const sampleNetworkEntry: HAREntry = {
  startedDateTime: '2024-01-01T00:00:00.000Z',
  request: { url: 'http://example.com', method: 'GET' },
  response: { status: 200, statusText: 'OK' },
}

/**
 * Flush pending microtasks (resolved promises) without advancing timers.
 * This lets mocked async capture functions resolve.
 */
async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    // Allow microtask queue to drain
  })
}

describe('useCaptureData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigationListener = null
    resetStorage()

    // Default mock returns
    mockCaptureNetwork.mockResolvedValue([sampleNetworkEntry])
    mockCaptureConsole.mockResolvedValue([sampleConsoleLog])
    mockClearCapturedConsoleLogs.mockResolvedValue(undefined)
    mockProbeServer.mockResolvedValue(false)

    // Mock chrome.devtools.network.onNavigated
    vi.stubGlobal('chrome', {
      ...chrome,
      devtools: {
        ...chrome.devtools,
        network: {
          ...chrome.devtools.network,
          onNavigated: mockOnNavigated,
        },
      },
    })

    // Start with visible state
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetStorage()
    mockCaptureNetwork.mockReset()
    mockCaptureConsole.mockReset()
    mockClearCapturedConsoleLogs.mockReset()
    mockProbeServer.mockReset()
    mockPushToServer.mockReset().mockResolvedValue(true)
    mockOnNavigated.addListener.mockClear()
  })

  it('probes persisted server URL and marks connection true when reachable', async () => {
    seedStorage({
      loggyPanelSettings: {
        serverUrl: 'http://custom:9999',
      },
    })
    mockProbeServer.mockResolvedValueOnce(true)

    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    expect(mockProbeServer).toHaveBeenCalledWith('http://custom:9999')
    expect(result.current.state.serverConnected).toBe(true)
  })

  it('sets serverConnected false when persisted server URL is not reachable', async () => {
    seedStorage({
      loggyPanelSettings: {
        serverUrl: 'http://custom:9999',
      },
    })
    mockProbeServer.mockResolvedValue(false)

    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    expect(mockProbeServer).toHaveBeenCalledTimes(1)
    expect(mockProbeServer).toHaveBeenCalledWith('http://custom:9999')
    expect(result.current.state.serverConnected).toBe(false)
  })

  it('keeps serverConnected false silently when probes fail', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    seedStorage({
      loggyPanelSettings: {
        serverUrl: 'http://custom:9999',
      },
    })
    mockProbeServer.mockResolvedValue(false)

    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    expect(result.current.state.serverConnected).toBe(false)
    expect(mockProbeServer).toHaveBeenCalledTimes(1)
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('server'),
      expect.anything()
    )
  })

  it('hydrates settings from storage on mount when persisted data exists', async () => {
    seedStorage({
      loggyPanelSettings: {
        consoleFilter: 'warn|error',
        networkFilter: 'api -health',
        consoleVisible: false,
        networkVisible: false,
        includeAgentContext: false,
        includeResponseBodies: true,
        truncateConsoleLogs: false,
        serverUrl: 'http://custom:1234',
      },
    })

    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    expect(chrome.storage.local.get).toHaveBeenCalledWith(
      [LOGGY_PANEL_SETTINGS_STORAGE_KEY],
      expect.any(Function)
    )
    expect(result.current.state.consoleFilter).toBe('warn|error')
    expect(result.current.state.networkFilter).toBe('api -health')
    expect(result.current.state.consoleVisible).toBe(false)
    expect(result.current.state.networkVisible).toBe(false)
    expect(result.current.state.includeAgentContext).toBe(false)
    expect(result.current.state.includeResponseBodies).toBe(true)
    expect(result.current.state.truncateConsoleLogs).toBe(false)
    expect(result.current.state.serverUrl).toBe('http://custom:1234')
  })

  it('keeps defaults when storage is empty on mount', async () => {
    const defaults = createInitialState()
    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    expect(result.current.state.consoleFilter).toBe(defaults.consoleFilter)
    expect(result.current.state.networkFilter).toBe(defaults.networkFilter)
    expect(result.current.state.consoleVisible).toBe(defaults.consoleVisible)
    expect(result.current.state.networkVisible).toBe(defaults.networkVisible)
    expect(result.current.state.includeAgentContext).toBe(defaults.includeAgentContext)
    expect(result.current.state.includeResponseBodies).toBe(defaults.includeResponseBodies)
    expect(result.current.state.truncateConsoleLogs).toBe(defaults.truncateConsoleLogs)
  })

  it('keeps defaults when storage payload is malformed on mount', async () => {
    const defaults = createInitialState()
    seedStorage({ loggyPanelSettings: 12345 })

    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    expect(result.current.state.consoleFilter).toBe(defaults.consoleFilter)
    expect(result.current.state.networkFilter).toBe(defaults.networkFilter)
    expect(result.current.state.consoleVisible).toBe(defaults.consoleVisible)
    expect(result.current.state.networkVisible).toBe(defaults.networkVisible)
    expect(result.current.state.includeAgentContext).toBe(defaults.includeAgentContext)
    expect(result.current.state.includeResponseBodies).toBe(defaults.includeResponseBodies)
    expect(result.current.state.truncateConsoleLogs).toBe(defaults.truncateConsoleLogs)
  })

  it('logs and safely falls back when storage access throws during hydration', async () => {
    const defaults = createInitialState()
    const storageError = new Error('storage unavailable')
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(chrome.storage.local.get).mockImplementationOnce(() => {
      throw storageError
    })

    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()
    vi.advanceTimersByTime(300)

    expect(result.current.state.consoleFilter).toBe(defaults.consoleFilter)
    expect(result.current.state.networkFilter).toBe(defaults.networkFilter)
    expect(result.current.state.consoleVisible).toBe(defaults.consoleVisible)
    expect(result.current.state.networkVisible).toBe(defaults.networkVisible)
    expect(result.current.state.includeAgentContext).toBe(defaults.includeAgentContext)
    expect(result.current.state.includeResponseBodies).toBe(defaults.includeResponseBodies)
    expect(result.current.state.truncateConsoleLogs).toBe(defaults.truncateConsoleLogs)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to hydrate persisted Loggy panel settings:',
      storageError
    )
    expect(mockChromeStorageSet).toHaveBeenCalledWith({
      [LOGGY_PANEL_SETTINGS_STORAGE_KEY]: {
        consoleFilter: defaults.consoleFilter,
        networkFilter: defaults.networkFilter,
        consoleVisible: defaults.consoleVisible,
        networkVisible: defaults.networkVisible,
        includeAgentContext: defaults.includeAgentContext,
        includeResponseBodies: defaults.includeResponseBodies,
        truncateConsoleLogs: defaults.truncateConsoleLogs,
        truncateResponseBodies: defaults.truncateResponseBodies,
        redactSensitiveInfo: defaults.redactSensitiveInfo,
        networkExportEnabled: defaults.networkExportEnabled,
        autoServerSync: defaults.autoServerSync,
        serverUrl: defaults.serverUrl,
        settingsAccordionOpen: defaults.settingsAccordionOpen,
        maxTokenLimit: defaults.maxTokenLimit,
        preserveLogs: defaults.preserveLogs,
      },
    })
  })

  it('skips persistence writes until hydration completes', async () => {
    let storageGetCallback:
      | ((items: Partial<Record<'loggyPanelSettings', unknown>>) => void)
      | null = null

    vi.mocked(chrome.storage.local.get).mockImplementationOnce(
      (_keys, callback: (items: Partial<Record<'loggyPanelSettings', unknown>>) => void) => {
        storageGetCallback = callback
      }
    )

    renderHook(() => useCaptureData())

    expect(mockChromeStorageSet).not.toHaveBeenCalled()
    expect(getStorage().loggyPanelSettings).toBeUndefined()

    await act(async () => {
      storageGetCallback?.({
        loggyPanelSettings: {
          consoleFilter: 'hydrated',
        },
      })
    })

    await flushMicrotasks()
    vi.advanceTimersByTime(300)

    expect(mockChromeStorageSet).toHaveBeenCalled()
  })

  it('calls captureConsoleLogs and captureNetworkEntries once on mount', async () => {
    renderHook(() => useCaptureData())

    // Flush startup capture promises
    await flushMicrotasks()

    expect(mockCaptureNetwork).toHaveBeenCalledTimes(1)
    expect(mockCaptureConsole).toHaveBeenCalledTimes(1)
  })

  it('triggers another capture after 2000ms auto-refresh', async () => {
    renderHook(() => useCaptureData())

    // Flush startup capture
    await flushMicrotasks()

    mockCaptureConsole.mockClear()
    mockCaptureNetwork.mockClear()

    // Advance by 2000ms to trigger auto-refresh interval
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    // Flush the capture promises triggered by interval
    await flushMicrotasks()

    expect(mockCaptureConsole).toHaveBeenCalledTimes(1)
    expect(mockCaptureNetwork).toHaveBeenCalledTimes(1)
  })

  it('stops auto-refresh when visibility changes to hidden', async () => {
    renderHook(() => useCaptureData())

    // Flush startup
    await flushMicrotasks()

    // Change to hidden
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    mockCaptureConsole.mockClear()
    mockCaptureNetwork.mockClear()

    // Advance timers - should NOT trigger capture since interval stopped
    await act(async () => {
      vi.advanceTimersByTime(4000)
    })
    await flushMicrotasks()

    expect(mockCaptureConsole).not.toHaveBeenCalled()
    expect(mockCaptureNetwork).not.toHaveBeenCalled()
  })

  it('restarts auto-refresh and captures immediately when visibility changes to visible', async () => {
    // Start hidden
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })

    renderHook(() => useCaptureData())

    // Flush startup capture (still fires on mount even when hidden)
    await flushMicrotasks()

    mockCaptureConsole.mockClear()
    mockCaptureNetwork.mockClear()

    // Change to visible
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await flushMicrotasks()

    // Should trigger immediate capture on becoming visible
    expect(mockCaptureConsole).toHaveBeenCalledTimes(1)
    expect(mockCaptureNetwork).toHaveBeenCalledTimes(1)

    mockCaptureConsole.mockClear()
    mockCaptureNetwork.mockClear()

    // Auto-refresh should be running again
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await flushMicrotasks()

    expect(mockCaptureConsole).toHaveBeenCalledTimes(1)
    expect(mockCaptureNetwork).toHaveBeenCalledTimes(1)
  })

  it('resets consoleLogs and networkEntries on navigation, preserving filter state', async () => {
    const { result } = renderHook(() => useCaptureData())

    // Flush startup to populate data
    await flushMicrotasks()

    expect(navigationListener).toBeDefined()

    // State should have captured data
    expect(result.current.state.consoleLogs).toEqual([sampleConsoleLog])
    expect(result.current.state.networkEntries).toEqual([sampleNetworkEntry])

    // Set a filter value to verify it's preserved after navigation
    await act(async () => {
      result.current.dispatch({ type: 'UPDATE_FILTER', field: 'consoleFilter', value: 'error' })
    })

    expect(result.current.state.consoleFilter).toBe('error')

    // Trigger navigation reset
    await act(async () => {
      navigationListener?.()
    })

    // consoleLogs and networkEntries should be empty, but filter preserved
    expect(result.current.state.consoleLogs).toEqual([])
    expect(result.current.state.networkEntries).toEqual([])
    expect(result.current.state.consoleFilter).toBe('error')
    expect(result.current.state.consoleVisible).toBe(true)
    expect(result.current.state.networkVisible).toBe(true)
    expect(result.current.state.includeAgentContext).toBe(true)
  })

  it('toggles includeAgentContext via dispatch', async () => {
    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    expect(result.current.state.includeAgentContext).toBe(true)

    await act(async () => {
      result.current.dispatch({ type: 'TOGGLE_AGENT_CONTEXT' })
    })

    expect(result.current.state.includeAgentContext).toBe(false)
  })

  it('toggles includeResponseBodies via dispatch', async () => {
    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    expect(result.current.state.includeResponseBodies).toBe(false)

    await act(async () => {
      result.current.dispatch({ type: 'TOGGLE_RESPONSE_BODIES' })
    })

    expect(result.current.state.includeResponseBodies).toBe(true)
  })

  it('preserves includeResponseBodies on navigation reset', async () => {
    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    // Toggle includeResponseBodies to true
    await act(async () => {
      result.current.dispatch({ type: 'TOGGLE_RESPONSE_BODIES' })
    })

    expect(result.current.state.includeResponseBodies).toBe(true)

    // Trigger navigation reset
    await act(async () => {
      navigationListener?.()
    })

    // includeResponseBodies should be preserved after navigation
    expect(result.current.state.includeResponseBodies).toBe(true)
  })

  it('toggles truncateConsoleLogs via dispatch', async () => {
    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    expect(result.current.state.truncateConsoleLogs).toBe(true)

    await act(async () => {
      result.current.dispatch({ type: 'TOGGLE_CONSOLE_TRUNCATION' })
    })

    expect(result.current.state.truncateConsoleLogs).toBe(false)
  })

  it('preserves truncateConsoleLogs on navigation reset', async () => {
    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    // Toggle truncateConsoleLogs to false
    await act(async () => {
      result.current.dispatch({ type: 'TOGGLE_CONSOLE_TRUNCATION' })
    })

    expect(result.current.state.truncateConsoleLogs).toBe(false)

    // Trigger navigation reset
    await act(async () => {
      navigationListener?.()
    })

    // truncateConsoleLogs should be preserved after navigation
    expect(result.current.state.truncateConsoleLogs).toBe(false)
  })

  it('prevents overlapping captures when isCapturing is true', async () => {
    // Make captureNetworkEntries hang (never resolve) to simulate in-progress capture
    let resolveNetwork: ((value: HAREntry[]) => void) | null = null
    mockCaptureNetwork.mockImplementation(
      () =>
        new Promise<HAREntry[]>((resolve) => {
          resolveNetwork = resolve
        })
    )

    renderHook(() => useCaptureData())

    // The initial capture is now in-flight (network promise not resolved yet)
    // Don't flush - let it stay pending

    // Advance timer to trigger auto-refresh capture
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })

    // captureNetworkEntries should have been called only once (the startup),
    // the auto-refresh call should be skipped because isCapturing is true
    expect(mockCaptureNetwork).toHaveBeenCalledTimes(1)

    // Now resolve the pending capture so isCapturing becomes false
    mockCaptureConsole.mockResolvedValue([sampleConsoleLog])
    await act(async () => {
      resolveNetwork?.([sampleNetworkEntry])
    })
    await flushMicrotasks()

    // Reset mocks to track fresh calls
    mockCaptureNetwork.mockResolvedValue([sampleNetworkEntry])
    mockCaptureConsole.mockClear()
    mockCaptureNetwork.mockClear()

    // Next interval tick should now succeed
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    await flushMicrotasks()

    // Now it should capture again since the previous one completed
    expect(mockCaptureNetwork).toHaveBeenCalledTimes(1)
  })

  it('keeps pre-clear HAR entries filtered out after clearData', async () => {
    const oldEntry: HAREntry = {
      startedDateTime: '2024-01-01T00:00:00.000Z',
      request: { url: 'http://example.com/old', method: 'GET' },
      response: { status: 200, statusText: 'OK' },
    }
    const newEntry: HAREntry = {
      startedDateTime: '2024-01-01T00:00:01.000Z',
      request: { url: 'http://example.com/new', method: 'GET' },
      response: { status: 200, statusText: 'OK' },
    }

    mockCaptureNetwork.mockResolvedValueOnce([oldEntry]).mockResolvedValueOnce([oldEntry, newEntry])
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2024-01-01T00:00:00.500Z'))

    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    await act(async () => {
      await result.current.clearData()
    })

    await act(async () => {
      await result.current.captureData()
    })

    expect(result.current.state.networkEntries).toEqual([newEntry])
  })

  it('stops server polling on unmount', async () => {
    mockProbeServer.mockResolvedValue(true)

    const { unmount } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    const initialCallCount = mockProbeServer.mock.calls.length

    unmount()

    // Advance timers - should not trigger more probes after unmount
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockProbeServer).toHaveBeenCalledTimes(initialCallCount)
  })

  it('excludes entries exactly at clear timestamp boundary', async () => {
    const boundaryEntry: HAREntry = {
      startedDateTime: '2024-01-01T00:00:00.500Z',
      request: { url: 'http://example.com/boundary', method: 'GET' },
      response: { status: 200, statusText: 'OK' },
    }
    const afterBoundaryEntry: HAREntry = {
      startedDateTime: '2024-01-01T00:00:00.501Z',
      request: { url: 'http://example.com/after-boundary', method: 'GET' },
      response: { status: 200, statusText: 'OK' },
    }

    mockCaptureNetwork
      .mockResolvedValueOnce([sampleNetworkEntry])
      .mockResolvedValueOnce([boundaryEntry, afterBoundaryEntry])
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2024-01-01T00:00:00.500Z'))

    const { result } = renderHook(() => useCaptureData())

    await flushMicrotasks()

    await act(async () => {
      await result.current.clearData()
    })

    await act(async () => {
      await result.current.captureData()
    })

    expect(result.current.state.networkEntries).toEqual([afterBoundaryEntry])
  })

  describe('auto-sync dedup', () => {
    it('skips pushToServer when content has not changed', async () => {
      seedStorage({
        loggyPanelSettings: {
          autoServerSync: true,
          serverUrl: 'http://localhost:8743',
        },
      })
      mockProbeServer.mockResolvedValue(true)

      const { result } = renderHook(() => useCaptureData())
      await flushMicrotasks()

      // After hydration, server should be connected and auto-sync enabled
      expect(result.current.state.serverConnected).toBe(true)
      expect(result.current.state.autoServerSync).toBe(true)

      // Flush startup capture so data is loaded
      await flushMicrotasks()

      // First auto-sync fires after 2500ms debounce
      mockPushToServer.mockClear()
      await act(async () => {
        vi.advanceTimersByTime(2500)
      })
      await flushMicrotasks()

      // pushToServer should have been called once for the initial data
      expect(mockPushToServer).toHaveBeenCalledTimes(1)

      // Now trigger a re-capture that returns the SAME data
      mockPushToServer.mockClear()
      await act(async () => {
        vi.advanceTimersByTime(2000) // auto-refresh interval
      })
      await flushMicrotasks()

      // Advance past the auto-sync debounce again
      await act(async () => {
        vi.advanceTimersByTime(2500)
      })
      await flushMicrotasks()

      // pushToServer should NOT be called again — content is identical
      expect(mockPushToServer).not.toHaveBeenCalled()
    })

    it('calls pushToServer when content changes', async () => {
      seedStorage({
        loggyPanelSettings: {
          autoServerSync: true,
          serverUrl: 'http://localhost:8743',
        },
      })
      mockProbeServer.mockResolvedValue(true)

      const { result } = renderHook(() => useCaptureData())
      await flushMicrotasks()

      expect(result.current.state.serverConnected).toBe(true)
      await flushMicrotasks()

      // First auto-sync
      await act(async () => {
        vi.advanceTimersByTime(2500)
      })
      await flushMicrotasks()

      expect(mockPushToServer).toHaveBeenCalledTimes(1)

      // Now change the captured data
      const newLog: ConsoleMessage = {
        timestamp: '2024-01-01T00:01:00.000Z',
        level: 'error',
        message: 'new error message',
      }
      mockCaptureConsole.mockResolvedValueOnce([sampleConsoleLog, newLog])
      mockCaptureNetwork.mockResolvedValueOnce([sampleNetworkEntry])

      mockPushToServer.mockClear()

      // Trigger re-capture with new data
      await act(async () => {
        vi.advanceTimersByTime(2000) // auto-refresh
      })
      await flushMicrotasks()

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(2500)
      })
      await flushMicrotasks()

      // pushToServer SHOULD be called because content changed
      expect(mockPushToServer).toHaveBeenCalledTimes(1)
    })

    it('exports when export option changes but skips if data stays the same across auto-refresh', async () => {
      seedStorage({
        loggyPanelSettings: {
          autoServerSync: true,
          serverUrl: 'http://localhost:8743',
        },
      })
      mockProbeServer.mockResolvedValue(true)

      renderHook(() => useCaptureData())
      await flushMicrotasks()
      await flushMicrotasks()

      // First auto-sync
      await act(async () => {
        vi.advanceTimersByTime(2500)
      })
      await flushMicrotasks()

      expect(mockPushToServer).toHaveBeenCalledTimes(1)

      // Trigger a re-capture that returns the SAME data — should skip
      mockPushToServer.mockClear()

      await act(async () => {
        vi.advanceTimersByTime(2000) // auto-refresh
      })
      await flushMicrotasks()

      await act(async () => {
        vi.advanceTimersByTime(2500) // debounce
      })
      await flushMicrotasks()

      // Same data → same fingerprint → no export
      expect(mockPushToServer).not.toHaveBeenCalled()
    })
  })
})

describe('reducer HYDRATE_SETTINGS', () => {
  it('hydrates only persisted settings and preserves selectedRoutes/consoleLogs/networkEntries', () => {
    const state = {
      ...createInitialState(),
      selectedRoutes: ['/api/users', '/api/orders'],
      consoleLogs: [sampleConsoleLog],
      networkEntries: [sampleNetworkEntry],
    }

    const hydrated = reducer(state, {
      type: 'HYDRATE_SETTINGS',
      settings: {
        consoleFilter: 'warn|error',
        networkFilter: 'api -health',
        consoleVisible: false,
        networkVisible: false,
        includeAgentContext: false,
        includeResponseBodies: true,
        truncateConsoleLogs: false,
        truncateResponseBodies: false,
        redactSensitiveInfo: true,
        networkExportEnabled: true,
        autoServerSync: false,
        serverUrl: 'http://custom:1234',
        settingsAccordionOpen: true,
        maxTokenLimit: 42000,
        preserveLogs: true,
      },
    })

    expect(hydrated.consoleFilter).toBe('warn|error')
    expect(hydrated.networkFilter).toBe('api -health')
    expect(hydrated.consoleVisible).toBe(false)
    expect(hydrated.networkVisible).toBe(false)
    expect(hydrated.includeAgentContext).toBe(false)
    expect(hydrated.includeResponseBodies).toBe(true)
    expect(hydrated.truncateConsoleLogs).toBe(false)
    expect(hydrated.serverUrl).toBe('http://custom:1234')
    expect(hydrated.selectedRoutes).toEqual(state.selectedRoutes)
    expect(hydrated.consoleLogs).toEqual(state.consoleLogs)
    expect(hydrated.networkEntries).toEqual(state.networkEntries)
  })

  it('validates hydrated values via merge helper and falls back to existing settings', () => {
    const state = {
      ...createInitialState(),
      consoleFilter: 'existing-console',
      networkFilter: 'existing-network',
      consoleVisible: false,
      networkVisible: false,
      includeAgentContext: false,
      includeResponseBodies: true,
      truncateConsoleLogs: false,
      selectedRoutes: ['/api/preserved'],
      consoleLogs: [sampleConsoleLog],
      networkEntries: [sampleNetworkEntry],
      serverUrl: 'http://localhost:8743',
    }

    const hydrated = reducer(state, {
      type: 'HYDRATE_SETTINGS',
      settings: {
        consoleFilter: 42,
        networkFilter: null,
        consoleVisible: 'yes',
        networkVisible: 1,
        includeAgentContext: 'no',
        includeResponseBodies: {},
        truncateConsoleLogs: [],
        serverUrl: 12345,
      } as unknown as PersistedLoggySettings,
    })

    expect(hydrated.consoleFilter).toBe('existing-console')
    expect(hydrated.networkFilter).toBe('existing-network')
    expect(hydrated.consoleVisible).toBe(false)
    expect(hydrated.networkVisible).toBe(false)
    expect(hydrated.includeAgentContext).toBe(false)
    expect(hydrated.includeResponseBodies).toBe(true)
    expect(hydrated.truncateConsoleLogs).toBe(false)
    expect(hydrated.serverUrl).toBe('http://localhost:8743')
    expect(hydrated.selectedRoutes).toEqual(state.selectedRoutes)
    expect(hydrated.consoleLogs).toEqual(state.consoleLogs)
    expect(hydrated.networkEntries).toEqual(state.networkEntries)
  })
})
