import { useCallback, useEffect, useRef, useState } from 'react'

import type {
  ConsentChangedMessage,
  GetTabExportDataMessage,
  GetTabStatusMessage,
  StartLoggingMessage,
  StopLoggingMessage,
  TabCaptureState,
  TabExportDataResponse,
} from '../types/messages'

export interface FabState {
  isActive: boolean
  logCount: number
  modalOpen: boolean
  isLogging: boolean
  copyStatus: 'idle' | 'copied' | 'error'
}

export interface FabActions {
  openModal: () => void
  closeModal: () => void
  toggleLogging: () => void
  copyToClipboard: () => void
}

const COPY_RESET_MS = 1600

export function useFabState(): { state: FabState; actions: FabActions } {
  const [isActive, setIsActive] = useState(false)
  const [logCount, setLogCount] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [isLogging, setIsLogging] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [captureMode, setCaptureMode] = useState<TabCaptureState['mode']>('inactive')
  const [hasConsent, setHasConsent] = useState(false)
  const [tabId, setTabId] = useState<number | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateActiveState = useCallback(
    (nextMode: TabCaptureState['mode'], consent: boolean) => {
      setCaptureMode(nextMode)
      setHasConsent(consent)
      setIsActive(nextMode !== 'inactive' && consent)
    },
    [],
  )

  const sendMessage = useCallback(
    <TResponse,>(
      message: GetTabStatusMessage | GetTabExportDataMessage | StartLoggingMessage | StopLoggingMessage,
    ) =>
      new Promise<TResponse | undefined>(resolve => {
        chrome.runtime.sendMessage(message, (response: TResponse | undefined) => {
          if (chrome.runtime.lastError) {
            resolve(undefined)
            return
          }
          resolve(response)
        })
      }),
    [],
  )

  const queryActiveTabId = useCallback(
    () =>
      new Promise<number | null>(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          resolve(tabs[0]?.id ?? null)
        })
      }),
    [],
  )

  const resolveTabId = useCallback(async (): Promise<number | null> => {
    if (tabId !== null) return tabId
    try {
      const resolvedId = await queryActiveTabId()
      if (resolvedId !== null) {
        setTabId(resolvedId)
      }
      return resolvedId
    } catch {
      return null
    }
  }, [queryActiveTabId, tabId])

  const fetchInitialStatus = useCallback(async (): Promise<void> => {
    const message: GetTabStatusMessage = { type: 'get-tab-status' }
    try {
      const response = await sendMessage<TabCaptureState>(message)
      if (typeof response?.tabId === 'number') {
        setTabId(response.tabId)
      }
      setLogCount(response?.logCount ?? 0)
      updateActiveState(response?.mode ?? 'inactive', response?.mode !== 'inactive')
    } catch {
      updateActiveState('inactive', false)
    }
  }, [sendMessage, updateActiveState])

  const handleConsentChanged = useCallback(
    (message: ConsentChangedMessage) => {
      if (message.type !== 'consent-changed') return
      const nextMode =
        message.captureMode && message.captureMode !== 'none'
          ? message.captureMode
          : captureMode
      const nextConsent = message.hasConsent ?? hasConsent
      const consentedMode = nextConsent ? nextMode : 'inactive'
      updateActiveState(consentedMode, nextConsent)
    },
    [captureMode, hasConsent, updateActiveState],
  )

  useEffect(() => {
    void fetchInitialStatus()

    const listener = (message: ConsentChangedMessage) => {
      handleConsentChanged(message)
    }
    chrome.runtime.onMessage.addListener(listener)

    return () => {
      chrome.runtime.onMessage.removeListener(listener)
    }
  }, [fetchInitialStatus, handleConsentChanged])

  useEffect(() => {
    if (!isActive && modalOpen) {
      setModalOpen(false)
    }
  }, [isActive, modalOpen])

  const openModal = useCallback(() => {
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
  }, [])

  const toggleLogging = useCallback(async () => {
    if (isLogging) return
    setIsLogging(true)
    try {
      const resolvedTabId = await resolveTabId()
      if (resolvedTabId === null) return
      if (captureMode === 'inactive') {
        const message: StartLoggingMessage = { type: 'start-logging', tabId: resolvedTabId }
        await sendMessage<void>(message)
      } else {
        const message: StopLoggingMessage = { type: 'stop-logging', tabId: resolvedTabId }
        await sendMessage<void>(message)
      }
      await fetchInitialStatus()
    } catch {
      setCopyStatus('error')
    } finally {
      setIsLogging(false)
    }
  }, [captureMode, fetchInitialStatus, isLogging, resolveTabId, sendMessage])

  const copyToClipboard = useCallback(async () => {
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = null
    }
    setCopyStatus('idle')
    try {
      const resolvedTabId = await resolveTabId()
      if (resolvedTabId === null) {
        setCopyStatus('error')
        return
      }
      const message: GetTabExportDataMessage = {
        type: 'get-tab-export-data',
        tabId: resolvedTabId,
      }
      const response = await sendMessage<TabExportDataResponse>(message)
      if (!response?.hasData || !response.markdown) {
        setCopyStatus('error')
        return
      }
      await navigator.clipboard.writeText(response.markdown)
      setLogCount(response.logCount ?? logCount)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      copyTimeoutRef.current = setTimeout(() => {
        setCopyStatus('idle')
      }, COPY_RESET_MS)
    }
  }, [logCount, resolveTabId, sendMessage])

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  return {
    state: {
      isActive,
      logCount,
      modalOpen,
      isLogging,
      copyStatus,
    },
    actions: {
      openModal,
      closeModal,
      toggleLogging,
      copyToClipboard,
    },
  }
}
