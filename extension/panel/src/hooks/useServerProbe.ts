import { useCallback, useEffect, useRef } from 'react'
import { probeServer } from '../../server-probe'
import type { Action } from './useCaptureData'

const SERVER_POLL_INTERVAL_MS = 5000

/**
 * Manages server connectivity probing and polling for the Loggy panel.
 * Probes the configured server URL when it changes and polls it periodically.
 */
export function useServerProbe(
  dispatch: React.Dispatch<Action>,
  serverUrl: string,
  hydrationCompleteRef: React.MutableRefObject<boolean>
): {
  probeConfiguredServer: (configuredServerUrl: string) => Promise<void>
  markUrlProbed: (url: string) => void
} {
  const lastProbedUrlRef = useRef<string | null>(null)
  const serverPollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const markUrlProbed = useCallback((url: string): void => {
    lastProbedUrlRef.current = url
  }, [])

  const probeConfiguredServer = useCallback(
    async (configuredServerUrl: string): Promise<void> => {
      const connected = await probeServer(configuredServerUrl)
      dispatch({ type: 'SET_SERVER_CONNECTED', value: connected })
    },
    [dispatch]
  )

  // Probe server when serverUrl changes (after hydration)
  useEffect(() => {
    if (!hydrationCompleteRef.current) return
    if (lastProbedUrlRef.current === serverUrl) return

    lastProbedUrlRef.current = serverUrl
    void probeConfiguredServer(serverUrl)
  }, [serverUrl, probeConfiguredServer, hydrationCompleteRef])

  // Start/stop server polling based on hydration state and serverUrl
  useEffect(() => {
    if (!hydrationCompleteRef.current) return

    if (serverPollTimer.current === null) {
      serverPollTimer.current = setInterval(() => {
        void probeConfiguredServer(serverUrl)
      }, SERVER_POLL_INTERVAL_MS)
    }

    return () => {
      if (serverPollTimer.current !== null) {
        clearInterval(serverPollTimer.current)
        serverPollTimer.current = null
      }
    }
  }, [probeConfiguredServer, serverUrl, hydrationCompleteRef])

  return { probeConfiguredServer, markUrlProbed }
}
