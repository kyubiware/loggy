import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { HAREntry } from '../../../types/har'
import PreviewContent from './PreviewContent'

const mocks = vi.hoisted(() => ({
  previewText: '',
  filteredNetworkEntries: [] as HAREntry[],
}))

vi.mock('../hooks/useFilteredData', () => ({
  useFilteredData: () => ({
    previewText: mocks.previewText,
    filteredData: { networkEntries: mocks.filteredNetworkEntries },
  }),
}))

vi.mock('../LoggyContext', () => ({
  useLogData: () => ({ networkEntries: mocks.filteredNetworkEntries }),
}))

describe('PreviewContent', () => {
  describe('text fidelity', () => {
    it('maintains strict byte-for-byte fidelity with input text', () => {
      mocks.previewText = `=== Debug Signals ===

- (3x) [error] 10:30:01 -> 10:30:05
  Unhandled exception in <WordView>
  
=== Console Logs (Consolidated) ===

(2x) [warn] 10:30:00
  Deprecation warning

=== Network Entries ===

[GET] 200 https://api.example.com/data`
      mocks.filteredNetworkEntries = []

      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')
      expect(element.textContent).toBe(mocks.previewText)
    })

    it('renders empty state text identically', () => {
      mocks.previewText =
        'No console logs or network entries match the current filters.\nData refreshes automatically while this panel is open.'
      mocks.filteredNetworkEntries = []
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')
      expect(element.textContent).toBe(mocks.previewText)
    })
  })

  describe('visibility', () => {
    it('applies hidden class when visible is false', () => {
      mocks.previewText = 'test'
      render(<PreviewContent visible={false} />)
      const element = screen.getByTestId('preview-output')
      expect(element).toHaveClass('hidden')
    })

    it('does not have hidden class when visible is true', () => {
      mocks.previewText = 'test'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')
      expect(element).not.toHaveClass('hidden')
    })
  })

  describe('syntax highlighting', () => {
    it('highlights section headers', () => {
      mocks.previewText = '=== Debug Signals ===\nOther text'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const headerSpan = element.querySelector('span.text-stone-950')
      expect(headerSpan).not.toBeNull()
      expect(headerSpan?.textContent).toBe('=== Debug Signals ===')
      expect(headerSpan).toHaveClass('dark:text-stone-50', 'font-semibold')
    })

    it('preserves bullets on debug signal lines', () => {
      mocks.previewText = '- [error] 12:00:00\n  Message'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      // Ensure the bullet exists in the text content
      expect(element.textContent).toMatch(/^- \[error\]/m)
    })

    it('highlights count prefixes', () => {
      mocks.previewText = '(3x) [log] 12:00:00\nMessage'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const countSpan = element.querySelector('span.text-sky-700')
      expect(countSpan).not.toBeNull()
      expect(countSpan?.textContent).toBe('(3x)')
      expect(countSpan).toHaveClass('dark:text-sky-300')
    })

    it('highlights error log levels', () => {
      mocks.previewText = '[error] 12:00:00'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const levelSpan = element.querySelector('span.text-rose-700')
      expect(levelSpan).not.toBeNull()
      expect(levelSpan?.textContent).toBe('[error]')
      expect(levelSpan).toHaveClass('dark:text-rose-300')
    })

    it('highlights warn log levels', () => {
      mocks.previewText = '[warn] 12:00:00'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const levelSpan = element.querySelector('span.text-amber-700')
      expect(levelSpan).not.toBeNull()
      expect(levelSpan?.textContent).toBe('[warn]')
      expect(levelSpan).toHaveClass('dark:text-amber-300')
    })

    it('highlights log, info, and debug levels', () => {
      mocks.previewText = '[log] 12:00:00\n[info] 12:00:01\n[debug] 12:00:02'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const levelSpans = Array.from(element.querySelectorAll('span.text-emerald-700'))
      expect(levelSpans.length).toBe(3)
      expect(levelSpans.find((span) => span.textContent === '[log]')).not.toBeUndefined()
      expect(levelSpans.find((span) => span.textContent === '[info]')).not.toBeUndefined()
      expect(levelSpans.find((span) => span.textContent === '[debug]')).not.toBeUndefined()
      expect(levelSpans[0]).toHaveClass('dark:text-emerald-300')
    })

    it('highlights single timestamps and timestamp ranges', () => {
      mocks.previewText = '[log] 10:30:01 -> 10:30:05\n[error] 10:30:06'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const timeSpans = Array.from(element.querySelectorAll('span.text-stone-500'))
      expect(
        timeSpans.find((span) => span.textContent === '10:30:01 -> 10:30:05')
      ).not.toBeUndefined()
      expect(timeSpans.find((span) => span.textContent === '10:30:06')).not.toBeUndefined()
      expect(timeSpans[0]).toHaveClass('dark:text-stone-400')
    })

    it('highlights HTTP methods', () => {
      mocks.previewText = '[GET] 200 https://api.example.com\n[POST] 404 https://api.example.com'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const methodSpans = Array.from(element.querySelectorAll('span.text-cyan-700'))
      expect(methodSpans.find((span) => span.textContent === '[GET]')).not.toBeUndefined()
      expect(methodSpans.find((span) => span.textContent === '[POST]')).not.toBeUndefined()
      expect(methodSpans[0]).toHaveClass('dark:text-cyan-300')
    })

    it('highlights HTTP statuses according to their class (2xx = log, 3xx = warn, 4xx/5xx = error)', () => {
      mocks.previewText = '[GET] 200 url\n[GET] 304 url\n[POST] 404 url\n[POST] 500 url'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const emeraldSpans = Array.from(element.querySelectorAll('span.text-emerald-700'))
      expect(emeraldSpans.find((span) => span.textContent === '200')).not.toBeUndefined()

      const amberSpans = Array.from(element.querySelectorAll('span.text-amber-700'))
      expect(amberSpans.find((span) => span.textContent === '304')).not.toBeUndefined()

      const roseSpans = Array.from(element.querySelectorAll('span.text-rose-700'))
      expect(roseSpans.find((span) => span.textContent === '404')).not.toBeUndefined()
      expect(roseSpans.find((span) => span.textContent === '500')).not.toBeUndefined()
    })

    it('highlights URLs', () => {
      mocks.previewText = '[GET] 200 https://api.example.com/data'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const urlSpan = element.querySelector('span.text-blue-700')
      expect(urlSpan).not.toBeNull()
      expect(urlSpan?.textContent).toBe('https://api.example.com/data')
      expect(urlSpan).toHaveClass('dark:text-blue-300', 'underline', 'decoration-blue-400/40')
    })

    it('colors indented message continuations', () => {
      mocks.previewText = '[log] 12:00:00\n  Indented message on next line\n  Another line'
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      const indentSpans = Array.from(element.querySelectorAll('span.text-stone-700'))
      expect(
        indentSpans.find((span) => span.textContent?.includes('Indented message'))
      ).not.toBeUndefined()
      expect(indentSpans[0]).toHaveClass('dark:text-stone-200')
    })
  })

  describe('edge cases', () => {
    it('renders unrecognized lines as plain text without crashing', () => {
      const text = 'This is a random line with no pattern\nAnother random line\nYet another line'
      mocks.previewText = text
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(text)
      // Should not have any span wrappers for unrecognized text
      const spans = element.querySelectorAll('span')
      expect(spans.length).toBe(0)
    })

    it('handles lines with regex special characters', () => {
      const text =
        'Line with [brackets] and (parens)\nAnother with $ dollar and ^ caret\nSpecial: * + ? . | \\'
      mocks.previewText = text
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(text)
      expect(element).not.toBeNull()
    })

    it('handles very long URLs without breaking layout', () => {
      const longUrl =
        'https://api.example.com/v1/endpoint/with/very/long/path?param1=value1&param2=value2&param3=value3&param4=value4&param5=value5&param6=value6&param7=value7&param8=value8'
      const text = `[GET] 200 ${longUrl}`
      mocks.previewText = text
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(text)
      const urlSpan = element.querySelector('span.text-blue-700')
      expect(urlSpan?.textContent).toBe(longUrl)
    })

    it('handles very long messages with indentation', () => {
      const longMessage =
        'This is a very long message that continues on and on with lots of text and should be properly truncated or displayed without breaking the layout or causing any issues with the rendering or formatting'
      const text = `[log] 12:00:00\n  ${longMessage}`
      mocks.previewText = text
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(text)
    })

    it('handles mixed content with recognized and unrecognized lines', () => {
      const text = `=== Header ===
[log] 12:00:00
  Indented message
This is random text between patterns
[error] 12:00:01
More random text
[GET] 200 https://api.example.com/data
Final random line`
      mocks.previewText = text
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(text)
    })

    it('handles empty lines and whitespace-only content', () => {
      const text = '\n\n   \n[log] 12:00:00\n\n\n'
      mocks.previewText = text
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(text)
    })

    it('handles partial pattern matches (lines that start with patterns but are malformed)', () => {
      const text = '[log\n[warn no timestamp\n[POST\n(random text with brackets)'
      mocks.previewText = text
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(text)
      expect(element).not.toBeNull()
    })

    it('handles URLs in non-method lines correctly', () => {
      const text =
        'Check https://api.example.com/data for more info\nAlso visit https://docs.example.com/guide'
      mocks.previewText = text
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(text)
      const urlSpans = Array.from(element.querySelectorAll('span.text-blue-700'))
      expect(urlSpans.length).toBe(2)
      expect(urlSpans[0].textContent).toBe('https://api.example.com/data')
      expect(urlSpans[1].textContent).toBe('https://docs.example.com/guide')
    })

    it('handles lines with only whitespace or special characters', () => {
      const text = '   \n\t\t\n---\n***\n'
      mocks.previewText = text
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(text)
    })

    it('preserves exact empty-state text content byte-for-byte', () => {
      const emptyState =
        'No console logs or network entries match the current filters.\nData refreshes automatically while this panel is open.'
      mocks.previewText = emptyState
      render(<PreviewContent visible={true} />)
      const element = screen.getByTestId('preview-output')

      expect(element.textContent).toBe(emptyState)
    })
  })

  describe('network entry expansion', () => {
    const mockNetworkEntries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { method: 'GET', url: 'https://api.example.com/data' },
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
        startedDateTime: '2024-01-15T10:30:01Z',
        request: { method: 'POST', url: 'https://api.example.com/create' },
        response: {
          status: 201,
          statusText: 'Created',
          // No content.text - should not be expandable
        },
      },
      {
        startedDateTime: '2024-01-15T10:30:02Z',
        request: { method: 'GET', url: 'https://api.example.com/long' },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            text: 'Very long response body that contains lots of text data',
            mimeType: 'text/plain',
          },
        },
      },
    ]

    const previewTextWithNetwork = `=== Network Entries ===

[GET] 200 https://api.example.com/data
[POST] 201 https://api.example.com/create
[GET] 200 https://api.example.com/long`

    it('expands network row on click when response body exists', async () => {
      mocks.previewText = previewTextWithNetwork
      mocks.filteredNetworkEntries = mockNetworkEntries
      const user = userEvent.setup()
      render(<PreviewContent visible={true} />)

      const toggleButton = screen.getByTestId('network-entry-toggle-2')
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

      await user.click(toggleButton)

      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByTestId('preview-output').textContent).toContain(`{
  "id": 1,
  "name": "Test"
}`)
    })

    it('collapses network row on second click', async () => {
      mocks.previewText = previewTextWithNetwork
      mocks.filteredNetworkEntries = mockNetworkEntries
      const user = userEvent.setup()
      render(<PreviewContent visible={true} />)

      const toggleButton = screen.getByTestId('network-entry-toggle-2')

      await user.click(toggleButton)
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByTestId('preview-output').textContent).toContain(`{
  "id": 1,
  "name": "Test"
}`)

      await user.click(toggleButton)
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByTestId('preview-output').textContent).not.toContain(`{
  "id": 1,
  "name": "Test"
}`)
    })

    it('does not render toggle button for network entries without response body', () => {
      mocks.previewText = previewTextWithNetwork
      mocks.filteredNetworkEntries = mockNetworkEntries
      render(<PreviewContent visible={true} />)

      expect(() => screen.getByTestId('network-entry-toggle-3')).toThrow()

      const element = screen.getByTestId('preview-output')
      expect(element.textContent).toContain('[POST] 201 https://api.example.com/create')
    })

    it('pretty-prints JSON response body text when expanded', async () => {
      mocks.previewText = previewTextWithNetwork
      mocks.filteredNetworkEntries = mockNetworkEntries
      const user = userEvent.setup()
      render(<PreviewContent visible={true} />)

      const toggleButton = screen.getByTestId('network-entry-toggle-2')
      await user.click(toggleButton)

      expect(screen.getByTestId('preview-output').textContent).toContain(`{
  "id": 1,
  "name": "Test"
}`)
    })

    it('preserves exact plain-text response body text when expanded', async () => {
      mocks.previewText = previewTextWithNetwork
      mocks.filteredNetworkEntries = mockNetworkEntries
      const user = userEvent.setup()
      render(<PreviewContent visible={true} />)

      const toggleButton = screen.getByTestId('network-entry-toggle-4')
      await user.click(toggleButton)

      expect(
        screen.getByText('Very long response body that contains lots of text data')
      ).toBeInTheDocument()
    })

    it('resets expansion when previewText changes', async () => {
      mocks.previewText = previewTextWithNetwork
      mocks.filteredNetworkEntries = mockNetworkEntries
      const user = userEvent.setup()
      const { rerender } = render(<PreviewContent visible={true} />)

      const toggleButton = screen.getByTestId('network-entry-toggle-2')
      await user.click(toggleButton)
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByTestId('preview-output').textContent).toContain(`{
  "id": 1,
  "name": "Test"
}`)

      const newPreviewText = `=== Network Entries ===

[GET] 200 https://api.example.com/data
[POST] 201 https://api.example.com/create`
      mocks.previewText = newPreviewText
      mocks.filteredNetworkEntries = [mockNetworkEntries[0], mockNetworkEntries[1]]
      rerender(<PreviewContent visible={true} />)

      const newToggleButton = screen.getByTestId('network-entry-toggle-2')
      expect(newToggleButton).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByTestId('preview-output').textContent).not.toContain(`{
  "id": 1,
  "name": "Test"
}`)
    })
  })
})
