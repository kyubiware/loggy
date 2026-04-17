import React from 'react'

type ToastType = 'success' | 'error'

interface ToastProps {
  message: string
  type: ToastType
  visible: boolean
}

/**
 * Toast notification component.
 * Always renders a data-testid="toast" element for test discoverability.
 * When not visible, renders a hidden empty element.
 */
const Toast = React.memo(function Toast({ message, type, visible }: ToastProps): React.JSX.Element {
  if (!visible) return <div data-testid="toast" hidden />

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600'

  return (
    <div
      data-testid="toast"
      className={`fixed bottom-4 right-4 px-4 py-2 rounded shadow-lg text-sm text-white ${bgColor} transition-opacity duration-300 z-50`}
    >
      {message}
    </div>
  )
})

export default Toast
