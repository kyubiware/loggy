import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionButtons } from './ActionButtons'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  clearAll: vi.fn(),
  copy: vi.fn(),
}))

vi.mock('../../LoggyContext', () => ({
  useActions: () => mocks,
}))

describe('ActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all three buttons with accessible names', () => {
    render(<ActionButtons />)

    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy to Clipboard + Server' })).toBeInTheDocument()
  })

  it('calls refresh when refresh button is clicked', () => {
    render(<ActionButtons />)

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('calls clearAll when clear all button is clicked', () => {
    render(<ActionButtons />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }))
    expect(mocks.clearAll).toHaveBeenCalledTimes(1)
  })

  it('calls copy when copy button is clicked', () => {
    render(<ActionButtons />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy to Clipboard + Server' }))
    expect(mocks.copy).toHaveBeenCalledTimes(1)
  })
})
