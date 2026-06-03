// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PopupHeader } from './PopupHeader'

afterEach(() => {
  cleanup()
})

describe('PopupHeader play/pause button', () => {
  it('shows play icon when logging is inactive', () => {
    render(
      <PopupHeader
        connected={false}
        showLoggingToggle={true}
        isLoggingActive={false}
        onToggleLogging={() => {}}
      />,
    )

    const button = screen.getByTitle('Start Logging')
    expect(button).toBeInTheDocument()
    // Play icon is an SVG — lucide renders as <svg>
    expect(button.querySelector('svg')).toBeInTheDocument()
    // Pause button should NOT be present
    expect(screen.queryByTitle('Stop Logging')).not.toBeInTheDocument()
  })

  it('shows pause icon when logging is active in content-script mode', () => {
    render(
      <PopupHeader
        connected={true}
        showLoggingToggle={true}
        isLoggingActive={true}
        onToggleLogging={() => {}}
      />,
    )

    const button = screen.getByTitle('Stop Logging')
    expect(button).toBeInTheDocument()
    expect(screen.queryByTitle('Start Logging')).not.toBeInTheDocument()
  })

  it('calls onToggleLogging when clicked', () => {
    const onToggle = vi.fn()
    render(
      <PopupHeader
        connected={true}
        showLoggingToggle={true}
        isLoggingActive={true}
        onToggleLogging={onToggle}
      />,
    )

    screen.getByTitle('Stop Logging').click()
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('does not render play/pause button when showLoggingToggle is false', () => {
    render(
      <PopupHeader
        connected={false}
        showLoggingToggle={false}
      />,
    )

    expect(screen.queryByTitle('Start Logging')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Stop Logging')).not.toBeInTheDocument()
  })
})
