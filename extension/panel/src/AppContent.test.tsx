import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LoggyState } from '../state'
import { AppContent } from './AppContent'
import { LoggyProvider } from './LoggyContext'

const mocks = vi.hoisted(() => ({
  stateOverrides: {} as Partial<LoggyState>,
  showToast: vi.fn(),
}))

vi.mock('./hooks/useToast', () => ({
  useToast: () => ({
    toastState: {
      message: '',
      type: 'success' as const,
      visible: false,
    },
    showToast: mocks.showToast,
  }),
}))

vi.mock('./actions', () => ({
  clearAction: vi.fn(async () => {}),
  copyAction: vi.fn(async () => {}),
}))

vi.mock('./hooks/useCaptureData', () => ({
  useCaptureData: () => ({
    state: {
      consoleFilter: '',
      networkFilter: '',
      selectedRoutes: [],
      consoleVisible: true,
      networkVisible: true,
      includeAgentContext: true,
      includeResponseBodies: false,
      truncateConsoleLogs: true,
      consoleLogs: [],
      networkEntries: [],
      ...mocks.stateOverrides,
    },
    dispatch: vi.fn(),
    captureData: vi.fn(async () => {}),
    clearData: vi.fn(async () => {}),
  }),
}))

describe('AppContent', () => {
  it('renders PreviewPane as the only main content section', () => {
    render(
      <LoggyProvider>
        <AppContent />
      </LoggyProvider>
    )

    // PreviewPane content should be present
    expect(screen.getByTestId('preview-output')).toBeInTheDocument()
    expect(screen.getByTestId('stats-summary')).toBeInTheDocument()
  })

  it('does not render a separate Controls section', () => {
    render(
      <LoggyProvider>
        <AppContent />
      </LoggyProvider>
    )

    // Should not have a Controls section with aria-label
    const controlsSection = screen.queryByLabelText('Controls')
    expect(controlsSection).not.toBeInTheDocument()
  })

  it('renders with single-surface layout (no sidebar)', () => {
    render(
      <LoggyProvider>
        <AppContent />
      </LoggyProvider>
    )

    // The app container should have the expected classes
    const appContainer = screen.getByTestId('preview-output').closest('#loggy-app')
    expect(appContainer).toHaveClass('flex-col')
    expect(appContainer).not.toHaveClass('md:flex-row')
  })

  it('filters are integrated into PreviewPane (not separate)', () => {
    render(
      <LoggyProvider>
        <AppContent />
      </LoggyProvider>
    )

    // Filter toggle should be present in PreviewPane header
    expect(screen.getByTestId('filters-panel-toggle')).toBeInTheDocument()

    // Action buttons should be present
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy to Clipboard + Server' })).toBeInTheDocument()
  })
})
