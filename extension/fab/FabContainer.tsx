import { Activity, Check, Circle, Copy, X } from 'lucide-react'

import { useFabState } from './useFabState'

export function FabContainer() {
  const {
    state: { isActive, logCount, modalOpen, isLogging, copyStatus },
    actions: { openModal, closeModal, toggleLogging, copyToClipboard },
  } = useFabState()

  const overlayClasses = modalOpen
    ? 'opacity-100 pointer-events-auto'
    : 'opacity-0 pointer-events-none'
  const sheetClasses = modalOpen
    ? 'translate-y-0 pointer-events-auto'
    : 'translate-y-full pointer-events-none'

  const copyLabel =
    copyStatus === 'copied'
      ? 'Copied!'
      : copyStatus === 'error'
        ? 'Copy failed'
        : 'Copy Logs'

  const statusLabel = isActive ? 'Logging' : 'Not logging'
  const toggleLabel = isActive ? 'Stop Logging' : 'Start Logging'

  const showFab = isActive && !modalOpen

  return (
    <div className='fixed inset-0 z-[2147483647] pointer-events-none font-sans'>
      {showFab && (
        <button
          type='button'
          onClick={openModal}
          className='fixed bottom-4 right-4 h-14 w-14 rounded-full bg-stone-900 text-white shadow-lg shadow-black/20 flex items-center justify-center pointer-events-auto dark:bg-white dark:text-stone-900'
          aria-label='Open Loggy panel'
        >
          <Activity className='h-6 w-6' />
          <span className='absolute -top-1 -right-1 flex h-3 w-3'>
            <span className='absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping' />
            <span className='relative inline-flex h-3 w-3 rounded-full bg-emerald-400' />
          </span>
        </button>
      )}

      <button
        type='button'
        onClick={closeModal}
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ${overlayClasses}`}
        aria-hidden={!modalOpen}
        aria-label='Close Loggy panel'
      />

      <div
        className={`fixed inset-x-0 bottom-0 h-[70dvh] rounded-t-2xl bg-white text-stone-900 shadow-2xl transition-transform duration-300 ease-out dark:bg-stone-900 dark:text-stone-100 ${sheetClasses}`}
        role='dialog'
        aria-modal='true'
      >
        <div className='flex items-center justify-between px-4 pt-3'>
          <div className='mx-auto h-1.5 w-12 rounded-full bg-stone-300 dark:bg-stone-700' />
          <button
            type='button'
            onClick={closeModal}
            className='ml-2 rounded-full p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
            aria-label='Close'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <div className='px-5 pt-4 flex flex-col gap-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2 text-sm font-medium'>
              <Circle
                className={`h-3 w-3 ${
                  isActive ? 'fill-emerald-400 text-emerald-400' : 'fill-stone-400 text-stone-400'
                }`}
              />
              <span>{statusLabel}</span>
            </div>
            <div className='text-sm text-stone-500 dark:text-stone-400'>
              Logs: {logCount}
            </div>
          </div>

          <button
            type='button'
            onClick={toggleLogging}
            disabled={isLogging}
            className='w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-60 dark:bg-white dark:text-stone-900'
          >
            {isLogging ? 'Working...' : toggleLabel}
          </button>

          <button
            type='button'
            onClick={copyToClipboard}
            className='w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-900 transition hover:bg-stone-50 dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-800'
          >
            <span className='inline-flex items-center gap-2'>
              {copyStatus === 'copied' ? (
                <Check className='h-4 w-4 text-emerald-500' />
              ) : (
                <Copy className='h-4 w-4' />
              )}
              {copyLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
