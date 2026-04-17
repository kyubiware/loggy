import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoggyState } from '../state'
import {
  type ActionsContextValue,
  type LogDataContextValue,
  LoggyProvider,
  type SettingsContextValue,
  useActions,
  useLogData,
  useSettings,
} from './LoggyContext'

const baseState: LoggyState = {
  consoleFilter: '',
  networkFilter: '',
  selectedRoutes: [],
  consoleVisible: true,
  networkVisible: true,
  includeAgentContext: true,
  includeResponseBodies: false,
  truncateConsoleLogs: true,
  redactSensitiveInfo: true,
  networkExportEnabled: true,
  autoServerSync: false,
  serverSyncError: false,
  serverUrl: 'http://localhost:8743',
  serverConnected: false,
  consoleLogs: [],
  networkEntries: [],
}

const mocks = vi.hoisted(() => ({
  state: {
    consoleFilter: '',
    networkFilter: '',
    selectedRoutes: [],
    consoleVisible: true,
    networkVisible: true,
    includeAgentContext: true,
    includeResponseBodies: false,
    truncateConsoleLogs: true,
    redactSensitiveInfo: true,
    networkExportEnabled: true,
    autoServerSync: false,
    serverSyncError: false,
    serverUrl: 'http://localhost:8743',
    serverConnected: false,
    consoleLogs: [],
    networkEntries: [],
  } as LoggyState,
  dispatch: vi.fn(),
  captureData: vi.fn(async () => {}),
  clearData: vi.fn(async () => {}),
  showToast: vi.fn(),
}))

// Mock dependencies
vi.mock('./actions', () => ({
  clearAction: vi.fn(),
  copyAction: vi.fn(),
}))

vi.mock('./hooks/useCaptureData', () => ({
  useCaptureData: vi.fn(() => ({
    state: mocks.state,
    dispatch: mocks.dispatch,
    captureData: mocks.captureData,
    clearData: mocks.clearData,
  })),
}))

vi.mock('./hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toastState: {
      message: '',
      type: 'success',
      visible: false,
    },
    showToast: mocks.showToast,
  })),
}))

const usersEntries = [
  {
    startedDateTime: '2024-01-01T00:00:00.000Z',
    request: { url: 'https://api.example.com/users', method: 'GET' },
    response: { status: 200, statusText: 'OK' },
  },
  {
    startedDateTime: '2024-01-01T00:00:01.000Z',
    request: { url: 'https://api.example.com/users/42', method: 'GET' },
    response: { status: 200, statusText: 'OK' },
  },
] satisfies LoggyState['networkEntries']

function getCapturedData(context: LogDataContextValue | null) {
  expect(context).not.toBeNull()
  return context as LogDataContextValue
}

function getCapturedSettings(context: SettingsContextValue | null) {
  expect(context).not.toBeNull()
  return context as SettingsContextValue
}

function getCapturedActions(context: ActionsContextValue | null) {
  expect(context).not.toBeNull()
  return context as ActionsContextValue
}

function TestComponent() {
  const { routeOptions, selectedRoutes } = useLogData()
  const { filtersVisible, includeResponseBodies } = useSettings()

  return (
    <div data-testid="test-component">
      <span data-testid="filters-visible">{String(filtersVisible)}</span>
      <span data-testid="include-response-bodies">{String(includeResponseBodies)}</span>
      <span data-testid="selected-routes">{selectedRoutes.join(',')}</span>
      <span data-testid="route-options">{routeOptions.join(',')}</span>
    </div>
  )
}

describe('LoggyContext', () => {
  beforeEach(() => {
    mocks.state = { ...baseState }
    mocks.dispatch.mockClear()
    mocks.captureData.mockClear()
    mocks.clearData.mockClear()
    mocks.showToast.mockClear()
  })

  it('provides selectedRoutes and routeOptions to consumers', () => {
    mocks.state = {
      ...mocks.state,
      networkEntries: usersEntries,
    }

    render(
      <LoggyProvider>
        <TestComponent />
      </LoggyProvider>
    )

    expect(screen.getByTestId('selected-routes').textContent).toBe('/users,/users/42')
    expect(screen.getByTestId('route-options').textContent).toBe('/users,/users/42')
  })

  describe('Context Hooks', () => {
    it('throws error when useLogData used outside provider', () => {
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        function BadComponent() {
          useLogData()
          return <div>Bad</div>
        }
        render(<BadComponent />)
      }).toThrow('useLogData must be used within LoggyProvider')

      console.error = originalError
    })

    it('throws error when useSettings used outside provider', () => {
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        function BadComponent() {
          useSettings()
          return <div>Bad</div>
        }
        render(<BadComponent />)
      }).toThrow('useSettings must be used within LoggyProvider')

      console.error = originalError
    })

    it('throws error when useActions used outside provider', () => {
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        function BadComponent() {
          useActions()
          return <div>Bad</div>
        }
        render(<BadComponent />)
      }).toThrow('useActions must be used within LoggyProvider')

      console.error = originalError
    })
  })

  describe('LoggyProvider', () => {
    it('toggles route selection on and off', async () => {
      mocks.state = {
        ...mocks.state,
        networkEntries: usersEntries,
      }

      let capturedData: LogDataContextValue | null = null
      let capturedActions: ActionsContextValue | null = null

      function CaptureContextComponent() {
        capturedData = useLogData()
        capturedActions = useActions()
        return <div>Captured</div>
      }

      render(
        <LoggyProvider>
          <CaptureContextComponent />
        </LoggyProvider>
      )

      // All routes are auto-selected on mount
      expect(getCapturedData(capturedData).selectedRoutes).toEqual(['/users', '/users/42'])

      await act(async () => {
        getCapturedActions(capturedActions).toggleRoute('/users')
      })
      expect(getCapturedData(capturedData).selectedRoutes).toEqual(['/users/42'])

      await act(async () => {
        getCapturedActions(capturedActions).toggleRoute('/users')
      })
      expect(getCapturedData(capturedData).selectedRoutes).toEqual(['/users/42', '/users'])
    })

    it('auto-prunes stale selected routes when available routes change', async () => {
      mocks.state = {
        ...mocks.state,
        networkEntries: usersEntries,
      }

      let capturedData: LogDataContextValue | null = null
      let capturedActions: ActionsContextValue | null = null

      function CaptureContextComponent() {
        capturedData = useLogData()
        capturedActions = useActions()
        return <div>Captured</div>
      }

      const { rerender } = render(
        <LoggyProvider>
          <CaptureContextComponent />
        </LoggyProvider>
      )

      // All routes auto-selected on mount
      expect(getCapturedData(capturedData).selectedRoutes).toEqual(['/users', '/users/42'])

      // Deselect /users to create a partially-selected state
      await act(async () => {
        getCapturedActions(capturedActions).toggleRoute('/users')
      })
      expect(getCapturedData(capturedData).selectedRoutes).toEqual(['/users/42'])

      mocks.state = {
        ...mocks.state,
        networkFilter: 'users/42',
        networkEntries: usersEntries,
      }

      await act(async () => {
        rerender(
          <LoggyProvider>
            <CaptureContextComponent />
          </LoggyProvider>
        )
      })

      expect(getCapturedData(capturedData).routeOptions).toEqual(['/users/42'])
      expect(getCapturedData(capturedData).selectedRoutes).toEqual(['/users/42'])
    })

    it('selectedRoutes resets across provider remounts', async () => {
      mocks.state = {
        ...mocks.state,
        networkEntries: usersEntries,
      }

      let capturedData: LogDataContextValue | null = null
      let capturedActions: ActionsContextValue | null = null

      function CaptureContextComponent() {
        capturedData = useLogData()
        capturedActions = useActions()
        return <div>Captured</div>
      }

      const { unmount } = render(
        <LoggyProvider>
          <CaptureContextComponent />
        </LoggyProvider>
      )

      await act(async () => {
        getCapturedActions(capturedActions).toggleRoute('/users')
      })
      expect(getCapturedData(capturedData).selectedRoutes).toEqual(['/users/42'])

      unmount()
      capturedData = null
      capturedActions = null

      render(
        <LoggyProvider>
          <CaptureContextComponent />
        </LoggyProvider>
      )

      // Auto-select resets to all routes on remount
      expect(getCapturedData(capturedData).selectedRoutes).toEqual(['/users', '/users/42'])
    })

    it('provides filtersVisible state to consumers (defaults to false)', () => {
      render(
        <LoggyProvider>
          <TestComponent />
        </LoggyProvider>
      )

      const filtersVisible = screen.getByTestId('filters-visible')
      expect(filtersVisible.textContent).toBe('false')
    })

    it('provides includeResponseBodies from state to consumers', () => {
      render(
        <LoggyProvider>
          <TestComponent />
        </LoggyProvider>
      )

      const includeResponseBodies = screen.getByTestId('include-response-bodies')
      expect(includeResponseBodies.textContent).toBe('false')
    })

    it('provides truncateConsoleLogs from state to consumers', () => {
      let capturedSettings: SettingsContextValue | null = null

      function CaptureStateComponent() {
        capturedSettings = useSettings()
        return <div>Captured</div>
      }

      render(
        <LoggyProvider>
          <CaptureStateComponent />
        </LoggyProvider>
      )

      expect(getCapturedSettings(capturedSettings).truncateConsoleLogs).toBe(true)
    })

    it('provides all required actions', () => {
      let capturedActions: ActionsContextValue | null = null

      function CaptureContextComponent() {
        capturedActions = useActions()
        return <div>Captured</div>
      }

      render(
        <LoggyProvider>
          <CaptureContextComponent />
        </LoggyProvider>
      )

      const actions = getCapturedActions(capturedActions)
      expect(actions.setConsoleFilter).toBeInstanceOf(Function)
      expect(actions.setNetworkFilter).toBeInstanceOf(Function)
      expect(actions.toggleConsoleVisibility).toBeInstanceOf(Function)
      expect(actions.toggleNetworkVisibility).toBeInstanceOf(Function)
      expect(actions.toggleAgentContext).toBeInstanceOf(Function)
      expect(actions.toggleResponseBodies).toBeInstanceOf(Function)
      expect(actions.toggleConsoleTruncation).toBeInstanceOf(Function)
      expect(actions.toggleRoute).toBeInstanceOf(Function)
      expect(actions.toggleFiltersVisible).toBeInstanceOf(Function)
      expect(actions.refresh).toBeInstanceOf(Function)
      expect(actions.clearAll).toBeInstanceOf(Function)
      expect(actions.copy).toBeInstanceOf(Function)
    })

    it('provides expected settings fields', () => {
      let capturedSettings: SettingsContextValue | null = null

      function CaptureStateComponent() {
        capturedSettings = useSettings()
        return <div>Captured</div>
      }

      render(
        <LoggyProvider>
          <CaptureStateComponent />
        </LoggyProvider>
      )

      const settings = getCapturedSettings(capturedSettings)
      expect(settings).toHaveProperty('consoleFilter')
      expect(settings).toHaveProperty('networkFilter')
      expect(settings).toHaveProperty('consoleVisible')
      expect(settings).toHaveProperty('networkVisible')
      expect(settings).toHaveProperty('includeAgentContext')
      expect(settings).toHaveProperty('includeResponseBodies')
      expect(settings).toHaveProperty('truncateConsoleLogs')
      expect(settings).toHaveProperty('filtersVisible')
      expect(settings).toHaveProperty('toastState')
    })

    it('provides expected data fields', () => {
      let capturedData: LogDataContextValue | null = null

      function CaptureDataComponent() {
        capturedData = useLogData()
        return <div>Captured</div>
      }

      render(
        <LoggyProvider>
          <CaptureDataComponent />
        </LoggyProvider>
      )

      const data = getCapturedData(capturedData)
      expect(data).toHaveProperty('consoleLogs')
      expect(data).toHaveProperty('networkEntries')
      expect(data).toHaveProperty('routeOptions')
      expect(data).toHaveProperty('selectedRoutes')
    })

    it('provides toastState object', () => {
      let capturedSettings: SettingsContextValue | null = null

      function CaptureToastStateComponent() {
        capturedSettings = useSettings()
        return <div>Captured</div>
      }

      render(
        <LoggyProvider>
          <CaptureToastStateComponent />
        </LoggyProvider>
      )

      const settings = getCapturedSettings(capturedSettings)
      expect(settings.toastState).not.toBeNull()
      expect(settings.toastState).toHaveProperty('message')
      expect(settings.toastState).toHaveProperty('type')
      expect(settings.toastState).toHaveProperty('visible')
    })
  })
})
