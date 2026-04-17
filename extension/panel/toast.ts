export type ToastType = 'success' | 'error'

export function showToast(message: string, type: ToastType): void {
  const toast = document.createElement('div')
  const slideOutDurationMs = 300
  const visibleDurationMs = 3000
  toast.className = `toast toast-${type}`
  toast.textContent = message

  document.body.appendChild(toast)

  requestAnimationFrame(() => {
    toast.classList.add('slideIn')
  })

  setTimeout(() => {
    toast.classList.remove('slideIn')
    toast.classList.add('slideOut')

    const fallbackRemoval = setTimeout(() => {
      toast.remove()
    }, slideOutDurationMs + 50)

    toast.addEventListener(
      'animationend',
      () => {
        clearTimeout(fallbackRemoval)
        toast.remove()
      },
      { once: true }
    )
  }, visibleDurationMs)
}
