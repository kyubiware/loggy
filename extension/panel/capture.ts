import type { DevToolsNetworkRequest } from '../browser-apis/index.js'
import { browser } from '../browser-apis/index.js'
import type { ConsoleMessage } from '../types/console'
import type { HAREntry } from '../types/har'
import type { PanelClosedMessage, PanelOpenedMessage } from '../types/messages'
import { CONSOLE_BOOTSTRAP_SCRIPT } from '../utils/console-bootstrap.mjs'

/** Resource types that represent programmatic API requests (fetch/XHR) */
const API_RESOURCE_TYPES = new Set(['fetch', 'xhr'])
const responseBodyCache = new Map<string, string>()

let responseBodyListener: ((request: DevToolsNetworkRequest) => void) | null = null

function getResponseBodyCacheKey(url: string, startedDateTime: string): string {
  return `${url}::${startedDateTime}`
}

/**
 * Filters HAR entries to only include fetch and XHR requests.
 * Entries without `_resourceType` are passed through (e.g., Firefox).
 */
function filterToAPIRequests(entries: HAREntry[]): HAREntry[] {
  return entries.filter((entry) => {
    if (!entry._resourceType) return true
    return API_RESOURCE_TYPES.has(entry._resourceType.toLowerCase())
  })
}

export async function captureNetworkEntries(): Promise<HAREntry[]> {
  return new Promise((resolve) => {
    browser.devtools.network.getHAR((harLog) => {
      const allEntries = harLog.entries || []
      resolve(filterToAPIRequests(allEntries))
    })
  })
}

export function startResponseBodyCapture(): void {
  if (responseBodyListener !== null) return

  responseBodyListener = (request) => {
    request.getContent((content) => {
      if (typeof content !== 'string' || content.length === 0) {
        return
      }

      responseBodyCache.set(
        getResponseBodyCacheKey(request.request.url, request.startedDateTime),
        content
      )
    })
  }

  browser.devtools.network.onRequestFinished.addListener(responseBodyListener)
}

export function stopResponseBodyCapture(): void {
  if (responseBodyListener === null) return

  browser.devtools.network.onRequestFinished.removeListener(responseBodyListener)
  responseBodyListener = null
}

export function clearResponseBodies(): void {
  responseBodyCache.clear()
}

export function enrichWithResponseBodies(entries: HAREntry[]): HAREntry[] {
  return entries.map((entry) => {
    if (entry.response.content?.text) {
      return entry
    }

    const cachedResponseBody = responseBodyCache.get(
      getResponseBodyCacheKey(entry.request.url, entry.startedDateTime)
    )

    if (!cachedResponseBody) {
      return entry
    }

    return {
      ...entry,
      response: {
        ...entry.response,
        content: {
          ...entry.response.content,
          text: cachedResponseBody,
        },
      },
    }
  })
}

export async function injectConsoleCapture(): Promise<void> {
  return new Promise((resolve, reject) => {
    browser.devtools.inspectedWindow.eval(CONSOLE_BOOTSTRAP_SCRIPT, (_result, isException) => {
      if (isException) {
        reject(new Error('Failed to inject console capture script'))
        return
      }

      resolve()
    })
  })
}

export async function captureConsoleLogs(): Promise<ConsoleMessage[]> {
  await injectConsoleCapture()

  return new Promise((resolve, reject) => {
    browser.devtools.inspectedWindow.eval(
      'window.__loggyConsoleLogs || []',
      (result, isException) => {
        if (isException) {
          reject(new Error('Failed to capture console logs from inspected window'))
          return
        }

        resolve(Array.isArray(result) ? (result as ConsoleMessage[]) : [])
      }
    )
  })
}

export async function clearCapturedConsoleLogs(): Promise<void> {
  return new Promise((resolve, reject) => {
    browser.devtools.inspectedWindow.eval(
      'window.__loggyConsoleLogs = [];',
      (_result, isException) => {
        if (isException) {
          reject(new Error('Failed to clear console logs in inspected window'))
          return
        }

        resolve()
      }
    )
  })
}

/**
 * Notify the background service worker that the DevTools panel has opened.
 */
export function notifyPanelOpened(tabId: number): void {
  try {
    const message: PanelOpenedMessage = { type: 'panel-opened', tabId }
    chrome.runtime.sendMessage(message)
  } catch {
    // Background not ready — ignore
  }
}

/**
 * Notify the background service worker that the DevTools panel has closed.
 */
export function notifyPanelClosed(tabId: number): void {
  try {
    const message: PanelClosedMessage = { type: 'panel-closed', tabId }
    chrome.runtime.sendMessage(message)
  } catch {
    // Background not ready — ignore
  }
}
