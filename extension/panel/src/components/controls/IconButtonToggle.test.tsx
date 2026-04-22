import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IconButtonToggle } from '../../../../shared/components/IconButtonToggle'

describe('IconButtonToggle', () => {
  const defaultProps = {
    icon: <span>Icon</span>,
    label: 'Toggle button',
    pressed: false,
    onToggle: vi.fn(),
  }

  it('renders with correct aria-pressed when pressed=true', () => {
    render(<IconButtonToggle {...defaultProps} pressed={true} />)
    const button = screen.getByRole('button', { name: 'Toggle button' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders with correct aria-pressed when pressed=false', () => {
    render(<IconButtonToggle {...defaultProps} pressed={false} />)
    const button = screen.getByRole('button', { name: 'Toggle button' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onToggle when clicked', () => {
    const handleToggle = vi.fn()
    render(<IconButtonToggle {...defaultProps} onToggle={handleToggle} />)

    const button = screen.getByRole('button', { name: 'Toggle button' })
    fireEvent.click(button)

    expect(handleToggle).toHaveBeenCalledTimes(1)
  })

  it('has correct testId attribute', () => {
    render(<IconButtonToggle {...defaultProps} testId="custom-test-id" />)

    const button = screen.getByTestId('custom-test-id')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'Toggle button')
  })

  it('wraps button in tooltip trigger', () => {
    const { container } = render(<IconButtonToggle {...defaultProps} />)
    // Radix Tooltip renders a wrapper div with data-state
    const trigger = container.querySelector('[data-state]')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toContainElement(screen.getByRole('button'))
  })

  it('uses custom tooltip prop for tooltip content', () => {
    const { container } = render(<IconButtonToggle {...defaultProps} tooltip="Custom text" />)
    // The button should still have aria-label from label prop
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Toggle button')
    // The tooltip trigger wrapper should exist
    expect(container.querySelector('[data-state]')).toBeInTheDocument()
  })
})
// deliberate bad format test
