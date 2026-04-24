import { act, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../../../types/state'
import { clearAction, copyAction } from '../actions'
import { useToast } from '../hooks/useToast'
import Toast from './Toast'

describe('Toast component', () => {
  it('renders hidden element when not visible', () => {
    render(<Toast message="" type="success" visible={false} />)
    const toast = screen.getByTestId('toast')
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveAttribute('hidden')
  })

  it('renders success toast with message', () => {
    render(<Toast message="Copied to clipboard!" type="success" visible={true} />)
    const toast = screen.getByTestId('toast')
    expect(toast).toBeInTheDocument()
    expect(toast).toHaveTextContent('Copied to clipboard!')
    expect(toast).toHaveClass('bg-green-600')
    expect(toast).not.toHaveAttribute('hidden')
  })

  it('renders error toast with message', () => {
    render(<Toast message="Failed to copy to clipboard" type="error" visible={true} />)
    const toast = screen.getByTestId('toast')
    expect(toast).toHaveTextContent('Failed to copy to clipboard')
    expect(toast).toHaveClass('bg-red-600')
  })
})

describe('useToast hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with invisible toast', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toastState.visible).toBe(false)
    expect(result.current.toastState.message).toBe('')
  })

  it('shows toast and auto-dismisses after 3000ms', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Logs cleared', 'success')
    })

    expect(result.current.toastState.visible).toBe(true)
    expect(result.current.toastState.message).toBe('Logs cleared')
    expect(result.current.toastState.type).toBe('success')

    // Advance past 3000ms dismissal timeout
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.toastState.visible).toBe(false)
  })

  it('resets timer when showing a new toast before dismissal', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('First message', 'success')
    })

    // Advance 2 seconds (before dismissal)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.toastState.visible).toBe(true)

    // Show a new toast — should reset the timer
    act(() => {
      result.current.showToast('Second message', 'error')
    })

    expect(result.current.toastState.message).toBe('Second message')
    expect(result.current.toastState.type).toBe('error')

    // Advance 2 seconds from new toast (total 4s from start) — still visible
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.toastState.visible).toBe(true)

    // Advance final 1 second — now dismissed (3s from second showToast)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.toastState.visible).toBe(false)
  })
})

describe('Copy action', () => {
  it('writes markdown to clipboard on success', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText: mockWriteText } })

    const { result } = renderHook(() => useToast())
    const state = createInitialState()

    await act(async () => {
      await copyAction(state, result.current.showToast)
    })

    expect(mockWriteText).toHaveBeenCalledWith(expect.any(String))
    expect(result.current.toastState.message).toBe('Copied to clipboard!')
    expect(result.current.toastState.type).toBe('success')
    expect(result.current.toastState.visible).toBe(true)

    vi.unstubAllGlobals()
  })

  it('shows error toast when clipboard write fails', async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error('Denied'))
    vi.stubGlobal('navigator', { clipboard: { writeText: mockWriteText } })

    const { result } = renderHook(() => useToast())
    const state = createInitialState()

    await act(async () => {
      await copyAction(state, result.current.showToast)
    })

    expect(result.current.toastState.message).toBe('Failed to copy to clipboard')
    expect(result.current.toastState.type).toBe('error')
    expect(result.current.toastState.visible).toBe(true)

    vi.unstubAllGlobals()
  })

  it('still copies to clipboard when server export is unreachable', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    // Mock fetch to reject after a short delay (simulating network failure)
    const mockFetch = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('server down')), 10)
      })
    })
    vi.stubGlobal('navigator', { clipboard: { writeText: mockWriteText } })
    vi.stubGlobal('fetch', mockFetch)

    const { result } = renderHook(() => useToast())
    const state = createInitialState()
    state.serverConnected = true
    state.serverUrl = 'https://example.com/export'

    await act(async () => {
      await copyAction(state, result.current.showToast)
    })

    // Clipboard copy should succeed
    expect(mockWriteText).toHaveBeenCalledWith(expect.any(String))
    // Initial toast should be clipboard success
    expect(result.current.toastState.message).toBe('Copied to clipboard!')
    expect(result.current.toastState.type).toBe('success')
    expect(result.current.toastState.visible).toBe(true)

    // Wait for server export failure toast to appear
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    // Final toast should be server export failure
    expect(result.current.toastState.message).toBe('Server export failed')
    expect(result.current.toastState.type).toBe('error')
    expect(result.current.toastState.visible).toBe(true)

    vi.unstubAllGlobals()
  })
})

describe('Clear action', () => {
  it('calls clearData and shows success toast', async () => {
    const mockClearData = vi.fn().mockResolvedValue(undefined)
    const { result } = renderHook(() => useToast())

    await act(async () => {
      await clearAction(mockClearData, result.current.showToast)
    })

    expect(mockClearData).toHaveBeenCalledOnce()
    expect(result.current.toastState.message).toBe('Logs cleared')
    expect(result.current.toastState.type).toBe('success')
    expect(result.current.toastState.visible).toBe(true)
  })

  it('shows error toast when clearing fails', async () => {
    const mockClearData = vi.fn().mockRejectedValue(new Error('clear failed'))
    const { result } = renderHook(() => useToast())

    await act(async () => {
      await clearAction(mockClearData, result.current.showToast)
    })

    expect(mockClearData).toHaveBeenCalledOnce()
    expect(result.current.toastState.message).toBe('Failed to clear logs')
    expect(result.current.toastState.type).toBe('error')
    expect(result.current.toastState.visible).toBe(true)
  })
})

describe('Toast dismissal timing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('toast disappears after 3000ms+300ms total window', () => {
    const { result } = renderHook(() => useToast())

    act(() => {
      result.current.showToast('Copied to clipboard!', 'success')
    })

    expect(result.current.toastState.visible).toBe(true)

    // At 2999ms, still visible
    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(result.current.toastState.visible).toBe(true)

    // At 3000ms, the visible flag is set to false
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.toastState.visible).toBe(false)

    // 300ms more for the slideout animation window — toast stays hidden
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.toastState.visible).toBe(false)
  })
})
