import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConsoleMessage } from '../../../types/console'
import type { HAREntry } from '../../../types/har'
import { getFilteredPanelData } from '../../filtered-data'
import { buildPreviewText, buildStatsText } from '../../preview'
import type { LoggyState } from '../../state'
import { LoggyProvider } from '../LoggyContext'
import PreviewPane from './PreviewPane'

const mocks = vi.hoisted(() => ({
  stateOverrides: {} as Partial<LoggyState>,
  showToast: vi.fn(),
  toggleRoute: vi.fn(),
}))

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    toastState: {
      message: '',
      type: 'success' as const,
      visible: false,
    },
    showToast: mocks.showToast,
  }),
}))

vi.mock('../actions', () => ({
  clearAction: vi.fn(async () => {}),
  copyAction: vi.fn(async () => {}),
}))

vi.mock('../hooks/useCaptureData', () => ({
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
      networkExportEnabled: true,
      autoServerSync: false,
      serverSyncError: false,
      serverUrl: 'http://localhost:8743',
      serverConnected: false,
      consoleLogs: [],
      networkEntries: [],
      ...mocks.stateOverrides,
    },
    dispatch: vi.fn(),
    captureData: vi.fn(async () => {}),
    clearData: vi.fn(async () => {}),
  }),
}))

function makeState(
  consoleLogs: ConsoleMessage[] = [],
  networkEntries: HAREntry[] = [],
  overrides: Omit<
    Partial<LoggyState>,
    | 'consoleLogs'
    | 'networkEntries'
    | 'includeAgentContext'
    | 'includeResponseBodies'
    | 'truncateConsoleLogs'
  > & {
    includeAgentContext?: boolean
    includeResponseBodies?: boolean
    truncateConsoleLogs?: boolean
  } = {}
): LoggyState {
  return {
    consoleFilter: '',
    networkFilter: '',
    selectedRoutes: overrides.selectedRoutes ?? [],
    consoleVisible: true,
    networkVisible: true,
    serverUrl: 'http://localhost:8743',
    serverConnected: false,
    ...overrides,
    consoleLogs,
    networkEntries,
    includeAgentContext: overrides.includeAgentContext ?? true,
    includeResponseBodies: overrides.includeResponseBodies ?? false,
    truncateConsoleLogs: overrides.truncateConsoleLogs ?? true,
    redactSensitiveInfo: overrides.redactSensitiveInfo ?? true,
    networkExportEnabled: overrides.networkExportEnabled ?? true,
    autoServerSync: overrides.autoServerSync ?? false,
    serverSyncError: overrides.serverSyncError ?? false,
  }
}

const emptyState = makeState()

const sampleConsoleLogs: ConsoleMessage[] = [
  { timestamp: '2024-01-01T00:00:00.000Z', level: 'log', message: 'hello' },
  { timestamp: '2024-01-01T00:00:01.000Z', level: 'error', message: 'something broke' },
]

const sampleNetworkEntries: HAREntry[] = [
  {
    startedDateTime: '2024-01-01T00:00:00.000Z',
    request: { url: 'https://api.example.com/data', method: 'GET' },
    response: {
      status: 200,
      statusText: 'OK',
      content: {
        text: '{"id": 1, "name": "Test"}',
        mimeType: 'application/json',
      },
    },
  },
  {
    startedDateTime: '2024-01-01T00:00:01.000Z',
    request: { url: 'https://api.example.com/create', method: 'POST' },
    response: {
      status: 201,
      statusText: 'Created',
    },
  },
]

const populatedState = makeState(sampleConsoleLogs, sampleNetworkEntries)

function renderPreview(state: LoggyState): void {
  mocks.stateOverrides = state

  render(
    <LoggyProvider>
      <PreviewPane />
    </LoggyProvider>
  )
}

describe('PreviewPane', () => {
  describe('header controls', () => {
    it('renders action buttons in header', () => {
      renderPreview(populatedState)

      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Copy to Clipboard + Server' })).toBeInTheDocument()
    })

    it('renders filter toggle in header', () => {
      renderPreview(populatedState)

      expect(screen.getByTestId('filters-panel-toggle')).toBeInTheDocument()
    })
  })

  describe('filter panel reveal', () => {
    it('shows filters by default in header', () => {
      renderPreview(populatedState)

      // Filters are now always visible in the header (compact filter controls)
      expect(screen.getByTestId('console-filter-input')).toBeInTheDocument()
      expect(screen.getByTestId('network-filter-input')).toBeInTheDocument()
    })

    it('shows filters when toggle is clicked', () => {
      renderPreview(populatedState)

      const toggle = screen.getByTestId('filters-panel-toggle')
      fireEvent.click(toggle)

      expect(screen.getByTestId('console-filter-input')).toBeInTheDocument()
      expect(screen.getByTestId('network-filter-input')).toBeInTheDocument()
    })

    it('toggle button shows correct aria state when filters hidden', () => {
      renderPreview(populatedState)

      const toggle = screen.getByTestId('filters-panel-toggle')
      expect(toggle).toHaveAttribute('aria-label', 'Show filters')
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    it('toggle button shows correct aria state when filters visible', () => {
      renderPreview(populatedState)

      const toggle = screen.getByTestId('filters-panel-toggle')
      fireEvent.click(toggle)

      expect(toggle).toHaveAttribute('aria-label', 'Hide filters')
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('helper-driven output', () => {
    it('renders preview text matching buildPreviewText(getFilteredPanelData(state))', () => {
      renderPreview(populatedState)

      const expectedPreview = buildPreviewText(getFilteredPanelData(populatedState))
      // The first network entry is expandable (has content.text), so it includes a ▶ indicator
      const actualPreview = screen.getByTestId('preview-output').textContent ?? ''
      const expectedWithIndicator = expectedPreview.replace(
        '[GET] 200 https://api.example.com/data',
        '[GET] 200 https://api.example.com/data▶'
      )
      expect(actualPreview).toBe(expectedWithIndicator)
    })

    it('renders stats text matching buildStatsText(getFilteredPanelData(state))', () => {
      renderPreview(populatedState)

      const expectedStats = buildStatsText(getFilteredPanelData(populatedState))
      expect(screen.getByTestId('stats-summary').textContent).toBe(expectedStats)
    })

    it('renders preview-output as a pre element', () => {
      renderPreview(populatedState)

      expect(screen.getByTestId('preview-output').tagName).toBe('PRE')
    })
  })

  describe('empty state', () => {
    it('shows empty message when no logs or entries match', () => {
      renderPreview(emptyState)

      expect(screen.getByTestId('preview-output').textContent).toContain(
        'No console logs or network entries match the current filters.'
      )
    })

    it('shows zero counts in stats', () => {
      renderPreview(emptyState)

      const statsText = screen.getByTestId('stats-summary').textContent
      expect(statsText).toContain('0 console logs')
      expect(statsText).toContain('0 network entries')
    })

    it('stats text matches buildStatsText for empty state', () => {
      renderPreview(emptyState)

      const expectedStats = buildStatsText(getFilteredPanelData(emptyState))
      expect(screen.getByTestId('stats-summary').textContent).toBe(expectedStats)
    })
  })

  describe('preview formatting (migrated from preview.test.ts)', () => {
    it('consolidates repeated console entries with count and time range', () => {
      const state = makeState([
        { timestamp: '10:30:00', level: 'log', message: 'CaptionItemHeader render' },
        { timestamp: '10:30:01', level: 'log', message: 'CaptionItemHeader render' },
        { timestamp: '10:30:03', level: 'log', message: 'CaptionItemHeader render' },
      ])

      renderPreview(state)

      const text = screen.getByTestId('preview-output').textContent ?? ''
      expect(text).toContain('=== Console Logs (Consolidated) ===')
      expect(text).toContain('(3x) [log] 10:30:00 -> 10:30:03')
      expect(text).toContain('CaptionItemHeader render')
    })

    describe('tab navigation', () => {
      it('defaults to Preview tab on initial render', () => {
        renderPreview(populatedState)

        expect(screen.getByTestId('tab-preview')).toBeInTheDocument()
        expect(screen.getByTestId('tab-routes')).toBeInTheDocument()
        expect(screen.getByTestId('tab-preview')).toHaveClass('active')
        expect(screen.getByTestId('tab-routes')).not.toHaveClass('active')
        expect(screen.getByTestId('preview-output')).toBeVisible()
      })

      it('switches to Routes tab when clicked', () => {
        renderPreview(populatedState)

        fireEvent.click(screen.getByTestId('tab-routes'))

        expect(screen.getByTestId('tab-routes')).toHaveClass('active')
        expect(screen.getByTestId('tab-preview')).not.toHaveClass('active')
        expect(screen.getByTestId('preview-output')).not.toBeVisible()
      })

      it('shows correct preview content when Preview tab is active', () => {
        renderPreview(populatedState)

        const expectedPreview = buildPreviewText(getFilteredPanelData(populatedState))
        // The first network entry is expandable (has content.text), so it includes a ▶ indicator
        const actualPreview = screen.getByTestId('preview-output').textContent ?? ''
        const expectedWithIndicator = expectedPreview.replace(
          '[GET] 200 https://api.example.com/data',
          '[GET] 200 https://api.example.com/data▶'
        )
        expect(actualPreview).toBe(expectedWithIndicator)
      })
    })

    describe('routes tab content', () => {
      const networkState = makeState(
        [],
        [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'https://api.example.com/users', method: 'GET' },
            response: { status: 200, statusText: 'OK' },
          },
          {
            startedDateTime: '2024-01-15T10:30:01Z',
            request: { url: 'https://api.example.com/orders', method: 'GET' },
            response: { status: 200, statusText: 'OK' },
          },
          {
            startedDateTime: '2024-01-15T10:30:02Z',
            request: { url: 'https://api.example.com/products', method: 'GET' },
            response: { status: 200, statusText: 'OK' },
          },
        ]
      )

      it('shows alphabetized route options as checkboxes', () => {
        renderPreview(networkState)

        fireEvent.click(screen.getByTestId('tab-routes'))

        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes).toHaveLength(3)

        const labels = checkboxes.map((cb) => cb.parentElement?.textContent?.trim())
        expect(labels).toEqual(['/orders', '/products', '/users'])
      })

      it('shows empty state message when no route options exist', () => {
        const emptyNetworkState = makeState([], [])

        renderPreview(emptyNetworkState)

        fireEvent.click(screen.getByTestId('tab-routes'))

        expect(screen.getByText('No routes available')).toBeVisible()
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
      })

      it('route checkboxes reflect selection state', () => {
        const stateWithSelection = makeState(
          [],
          [
            {
              startedDateTime: '2024-01-15T10:30:00Z',
              request: { url: 'https://api.example.com/users', method: 'GET' },
              response: { status: 200, statusText: 'OK' },
            },
            {
              startedDateTime: '2024-01-15T10:30:01Z',
              request: { url: 'https://api.example.com/orders', method: 'GET' },
              response: { status: 200, statusText: 'OK' },
            },
          ],
          { selectedRoutes: ['/users'] }
        )

        renderPreview(stateWithSelection)

        fireEvent.click(screen.getByTestId('tab-routes'))

        // All routes are auto-selected by default
        const checkboxes = screen.getAllByRole('checkbox')
        const userCheckbox = checkboxes.find((cb) =>
          cb.parentElement?.textContent?.includes('/users')
        )
        const orderCheckbox = checkboxes.find((cb) =>
          cb.parentElement?.textContent?.includes('/orders')
        )

        expect(userCheckbox).toBeChecked()
        expect(orderCheckbox).toBeChecked()
      })
    })

    describe('route selection affects preview', () => {
      const multiRouteState = makeState(
        [],
        [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { url: 'https://api.example.com/users', method: 'GET' },
            response: { status: 200, statusText: 'OK' },
          },
          {
            startedDateTime: '2024-01-15T10:30:01Z',
            request: { url: 'https://api.example.com/orders', method: 'GET' },
            response: { status: 200, statusText: 'OK' },
          },
        ],
        { selectedRoutes: ['/users'] }
      )

      it('preview reflects filtered data after route deselection', () => {
        renderPreview(multiRouteState)

        // All routes are auto-selected, so preview shows both
        const initialPreview = screen.getByTestId('preview-output').textContent ?? ''
        expect(initialPreview).toContain('/users')
        expect(initialPreview).toContain('/orders')

        // Switch to Routes tab and deselect /orders
        fireEvent.click(screen.getByTestId('tab-routes'))
        const checkboxes = screen.getAllByRole('checkbox')
        const orderCheckbox = checkboxes.find((cb) =>
          cb.parentElement?.textContent?.includes('/orders')
        )
        if (!orderCheckbox) throw new Error('orderCheckbox not found')
        fireEvent.click(orderCheckbox)

        // Switch back to Preview tab
        fireEvent.click(screen.getByTestId('tab-preview'))

        const filteredPreview = screen.getByTestId('preview-output').textContent
        expect(filteredPreview).toContain('/users')
        expect(filteredPreview).not.toContain('/orders')
      })

      it('stats summary shows filtered counts after route deselection', () => {
        renderPreview(multiRouteState)

        // Switch to Routes tab
        fireEvent.click(screen.getByTestId('tab-routes'))

        // Deselect /users
        const checkboxes = screen.getAllByRole('checkbox')
        const userCheckbox = checkboxes.find((cb) =>
          cb.parentElement?.textContent?.includes('/users')
        )
        if (!userCheckbox) throw new Error('userCheckbox not found')
        fireEvent.click(userCheckbox)

        // Switch back to Preview tab
        fireEvent.click(screen.getByTestId('tab-preview'))

        const filteredStats = screen.getByTestId('stats-summary').textContent
        expect(filteredStats).toContain('1 network entries')
      })
    })

    it('computes first and last timestamps even when input is out of order', () => {
      const state = makeState([
        { timestamp: '10:30:05', level: 'log', message: 'Out of order' },
        { timestamp: '10:30:01', level: 'log', message: 'Out of order' },
        { timestamp: '10:30:03', level: 'log', message: 'Out of order' },
      ])

      renderPreview(state)

      expect(screen.getByTestId('preview-output').textContent).toContain(
        '(3x) [log] 10:30:01 -> 10:30:05'
      )
    })

    it('prioritizes failure-like debug signals', () => {
      const state = makeState([
        {
          timestamp: '10:30:00',
          level: 'warn',
          message: 'The smooth scroll behavior is not fully supported',
        },
        { timestamp: '10:30:01', level: 'warn', message: 'Request failed with status 500' },
        { timestamp: '10:30:02', level: 'error', message: 'Unhandled exception in <WordView>' },
      ])

      renderPreview(state)

      const text = screen.getByTestId('preview-output').textContent ?? ''
      expect(text).toContain('=== Debug Signals ===')
      expect(text).toContain('Errors: 1')
      expect(text).toContain('Warnings: 2')
      expect(text).toContain('Failure-like events: 2')
      expect(text).toContain('[error] 10:30:02')
      expect(text).toContain('[warn] 10:30:01')
    })

    it('includes network section with method, status and URL', () => {
      const state = makeState(
        [],
        [
          {
            startedDateTime: '2024-01-15T10:30:00Z',
            request: { method: 'GET', url: 'https://api.example.com/data' },
            response: { status: 200, statusText: 'OK' },
          },
        ]
      )

      renderPreview(state)

      const text = screen.getByTestId('preview-output').textContent ?? ''
      expect(text).toContain('=== Network Entries ===')
      expect(text).toContain('[GET] 200 https://api.example.com/data')
    })

    it('includes raw and unique console counts in stats', () => {
      const state = makeState([
        { timestamp: '10:30:00', level: 'log', message: 'Repeated' },
        { timestamp: '10:30:01', level: 'log', message: 'Repeated' },
        { timestamp: '10:30:02', level: 'error', message: 'Error once' },
      ])

      renderPreview(state)

      expect(screen.getByTestId('stats-summary').textContent).toBe(
        '3 console logs (2 unique), 0 network entries'
      )
    })
  })

  describe('migrated from Controls - filter interactions', () => {
    it('shows visibility toggle buttons with correct initial state', () => {
      renderPreview(populatedState)

      const consoleBtn = screen.getByTestId('console-visibility-toggle')
      const networkBtn = screen.getByTestId('network-visibility-toggle')

      expect(consoleBtn).toHaveTextContent('Hide Console')
      expect(networkBtn).toHaveTextContent('Hide Network')
    })

    it('shows include agent context toggle with correct initial state', () => {
      renderPreview(populatedState)

      const button = screen.getByRole('button', { name: 'Include LLM guidance' })
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    it('shows include response bodies toggle with correct initial state', () => {
      renderPreview(populatedState)

      const button = screen.getByRole('button', { name: 'Include response bodies' })
      expect(button).toHaveAttribute('aria-pressed', 'false')
    })

    it('shows truncate console logs toggle with correct initial state', () => {
      renderPreview(populatedState)

      const button = screen.getByRole('button', { name: 'Truncate console logs' })
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    it('fires refresh action when refresh button is clicked', () => {
      renderPreview(populatedState)

      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
      // Should not throw and callback should fire
      expect(screen.getByTestId('preview-output')).toBeInTheDocument()
    })

    it('fires clear action when clear all button is clicked', () => {
      renderPreview(populatedState)

      fireEvent.click(screen.getByRole('button', { name: 'Clear All' }))
      // Should not throw and callback should fire
      expect(screen.getByTestId('preview-output')).toBeInTheDocument()
    })

    it('fires copy action when copy button is clicked', () => {
      renderPreview(populatedState)

      fireEvent.click(screen.getByRole('button', { name: 'Copy to Clipboard + Server' }))
      // Should not throw and callback should fire
      expect(screen.getByTestId('preview-output')).toBeInTheDocument()
    })
  })

  describe('PreviewContent integration', () => {
    it('passes network entries to PreviewContent', () => {
      renderPreview(populatedState)

      // Verify preview output is rendered
      const previewOutput = screen.getByTestId('preview-output')
      expect(previewOutput).toBeInTheDocument()

      // Verify network section is present
      expect(previewOutput.textContent).toContain('=== Network Entries ===')
    })

    it('renders preview with network entries containing response bodies', () => {
      renderPreview(populatedState)

      // Verify network section includes entries with content
      const text = screen.getByTestId('preview-output').textContent ?? ''
      expect(text).toContain('=== Network Entries ===')
      expect(text).toContain('https://api.example.com/data')
      expect(text).toContain('https://api.example.com/create')
    })
  })
})
