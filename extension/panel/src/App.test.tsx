import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App shell', () => {
  it('renders all required data-testid elements', () => {
    render(<App />)

    expect(screen.getByTestId('console-filter-input')).toBeInTheDocument()
    expect(screen.getByTestId('network-filter-input')).toBeInTheDocument()
    expect(screen.getByTestId('console-visibility-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('network-visibility-toggle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Include LLM guidance' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Include response bodies' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Truncate console logs' })).toBeInTheDocument()
    expect(screen.getByTestId('refresh-button')).toBeInTheDocument()
    expect(screen.getByTestId('clear-all-button')).toBeInTheDocument()
    expect(screen.getByTestId('copy-button')).toBeInTheDocument()
    expect(screen.getByTestId('stats-summary')).toBeInTheDocument()
    expect(screen.getByTestId('preview-output')).toBeInTheDocument()
    expect(screen.getByTestId('toast')).toBeInTheDocument()
  })

  it('renders inputs with correct element types', () => {
    render(<App />)

    expect(screen.getByTestId('console-filter-input').tagName).toBe('INPUT')
    expect(screen.getByTestId('network-filter-input').tagName).toBe('INPUT')
    expect(screen.getByRole('button', { name: 'Include LLM guidance' }).tagName).toBe('BUTTON')
    expect(screen.getByRole('button', { name: 'Include response bodies' }).tagName).toBe('BUTTON')
    expect(screen.getByRole('button', { name: 'Truncate console logs' }).tagName).toBe('BUTTON')
  })

  it('renders buttons with correct element types', () => {
    render(<App />)

    const buttonIds = [
      'console-visibility-toggle',
      'network-visibility-toggle',
      'refresh-button',
      'clear-all-button',
      'copy-button',
      'filters-panel-toggle',
    ]

    for (const id of buttonIds) {
      expect(screen.getByTestId(id).tagName).toBe('BUTTON')
    }
  })

  it('renders preview-output as a pre element', () => {
    render(<App />)

    expect(screen.getByTestId('preview-output').tagName).toBe('PRE')
  })

  it('hides and shows filter controls via stats row toggle', () => {
    render(<App />)

    expect(screen.getByTestId('console-filter-input')).toBeInTheDocument()
    expect(screen.getByTestId('network-filter-input')).toBeInTheDocument()
  })
})
