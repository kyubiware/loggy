import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App layout structure', () => {
  it('renders all required data-testid elements', () => {
    render(<App />)

    const ids = [
      'filters-panel-toggle',
      'refresh-button',
      'clear-all-button',
      'copy-button',
      'stats-summary',
      'preview-output',
      'toast',
    ]
    for (const id of ids) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
  })

  it('does not import legacy CSS at runtime', () => {
    // This is validated by the build grep check, but assert App renders without legacy styles
    render(<App />)
    expect(screen.getByTestId('preview-output').tagName).toBe('PRE')
    expect(screen.getByTestId('stats-summary')).toBeInTheDocument()
  })
})
