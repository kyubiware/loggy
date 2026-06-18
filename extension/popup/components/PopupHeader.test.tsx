// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('PopupHeader devtools mode (panel open)', () => {
  it('shows Panel Active badge instead of play/pause toggle when isDevtoolsMode is true', () => {
    render(
      <PopupHeader
        connected={true}
        showLoggingToggle={true}
        isLoggingActive={true}
        isDevtoolsMode={true}
        onToggleLogging={() => {}}
      />,
    )

    // Toggle buttons must be absent — popup cannot control panel capture
    expect(screen.queryByTitle('Start Logging')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Stop Logging')).not.toBeInTheDocument()
    // Badge must be present
    expect(screen.getByTitle('Panel Active')).toBeInTheDocument()
  })

  it('does not show Panel Active badge when isDevtoolsMode is false', () => {
    render(
      <PopupHeader
        connected={true}
        showLoggingToggle={true}
        isLoggingActive={false}
        isDevtoolsMode={false}
        onToggleLogging={() => {}}
      />,
    )

    expect(screen.queryByTitle('Panel Active')).not.toBeInTheDocument()
    expect(screen.getByTitle('Start Logging')).toBeInTheDocument()
  })

  it('Panel Active badge is non-interactive (no button element)', () => {
    render(
      <PopupHeader
        connected={true}
        showLoggingToggle={true}
        isLoggingActive={true}
        isDevtoolsMode={true}
        onToggleLogging={vi.fn()}
      />,
    )

    const badge = screen.getByTitle('Panel Active')
    // Badge is a span, not a button — clicking it must not invoke the toggle
    expect(badge.tagName).toBe('SPAN')
    expect(badge.querySelector('button')).toBeNull()
  })
})
