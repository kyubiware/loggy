import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Popup from './Popup'

const mockUsePopupActions = vi.hoisted(() => ({
  status: { connected: true, mode: 'devtools' as const },
  isFirefox: false,
  isLoading: false,
  isEnhanced: false,
  showConsentView: false,
  currentHost: 'example.com',
  settings: {
    includeAgentContext: true,
    includeResponseBodies: false,
    truncateConsoleLogs: true,
    redactSensitiveInfo: false,
    networkExportEnabled: false,
    autoServerSync: false,
    consoleVisible: true,
    networkVisible: true,
    consoleFilter: '',
    networkFilter: '',
    serverUrl: 'http://localhost:8743',
  },
  setSetting: vi.fn(),
  localConsoleFilter: '',
  handleConsoleFilterChange: vi.fn(),
  localNetworkFilter: '',
  handleNetworkFilterChange: vi.fn(),
  serverConnected: false,
  handleServerUrlChange: vi.fn(),
  handleRetryConnection: vi.fn(),
  tokenCount: 0,
  hasData: false,
  copyStatus: 'idle' as const,
  handleStartLogging: vi.fn(),
  handleStopLogging: vi.fn(),
  handleAlwaysLog: vi.fn(),
  handleToggleDebugger: vi.fn(),
  handleRemoveAlwaysLog: vi.fn(),
  handlePreview: vi.fn(),
  copyToClipboard: vi.fn(),
}))

vi.mock('./hooks/usePopupActions', () => ({
  usePopupActions: () => mockUsePopupActions,
}))

beforeEach(() => {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome ?? ({} as typeof chrome)
  Object.assign(chromeApi, {
    runtime: {
      sendMessage: vi.fn((_message: unknown, callback?: (response: unknown) => void) => {
        if (callback) {
          callback({ type: 'always-log-hosts', hosts: [] })
        }
      }),
    },
  })
  ;(globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome = chromeApi
})

describe('Popup responsive classes', () => {
  it('has all mobile responsive classes at 375px viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

    const { container } = render(<Popup />)

    const mainContainer = container.firstElementChild as HTMLElement
    expect(mainContainer.className).toContain('w-full')
    expect(mainContainer.className).toContain('max-sm:min-h-[100dvh]')
    expect(mainContainer.className).toContain('max-sm:flex-1')
    expect(mainContainer.className).toContain('max-sm:overflow-y-auto')

    const popupHeader = screen.getByText('Loggy').closest('div') as HTMLElement
    expect(popupHeader.className).toContain('max-sm:sticky')

    const exportTogglesContainer = container.querySelector('.flex-wrap') as HTMLElement
    expect(exportTogglesContainer.className).toContain('flex-wrap')

    const iconButtonToggle = screen.getByRole('button', { name: 'Include LLM guidance' })
    expect(iconButtonToggle.className).toContain('max-sm:w-11')

    const filterInput = screen.getByPlaceholderText('Filter console (regex)...')
    expect(filterInput.className).toContain('max-sm:py-3')
  })

  it('has desktop responsive classes at 800px viewport and no leaking mobile classes', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 800,
    })

    const { container } = render(<Popup />)

    const mainContainer = container.firstElementChild as HTMLElement
    expect(mainContainer.className).toContain('sm:w-80')

    const iconButtonToggle = screen.getByRole('button', { name: 'Include LLM guidance' })
    expect(iconButtonToggle.className).toContain('w-6')
    expect(iconButtonToggle.className).toContain('h-6')

    const popupHeader = screen.getByText('Loggy').closest('div') as HTMLElement
    const headerClasses = popupHeader.className.split(' ')
    expect(headerClasses).not.toContain('sticky')
  })
})
