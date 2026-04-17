import { useCallback, useRef, useState } from 'react'

type ToastType = 'success' | 'error'

interface ToastState {
  message: string
  type: ToastType
  visible: boolean
}

const VISIBLE_DURATION_MS = 3000

/**
 * Hook to manage toast notification state.
 * Displays a toast message for 3 seconds, then auto-dismisses.
 */
export function useToast(): {
  toastState: ToastState
  showToast: (message: string, type: ToastType) => void
} {
  const [toastState, setToastState] = useState<ToastState>({
    message: '',
    type: 'success',
    visible: false,
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, type: ToastType): void => {
    // Clear any existing dismissal timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
    }

    setToastState({ message, type, visible: true })

    timerRef.current = setTimeout(() => {
      setToastState((prev) => ({ ...prev, visible: false }))
      timerRef.current = null
    }, VISIBLE_DURATION_MS)
  }, [])

  return { toastState, showToast }
}
