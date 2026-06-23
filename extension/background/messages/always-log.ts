import { addAlwaysLogHost, getAlwaysLogHosts, removeAlwaysLogHost } from '../storage'
import {
  injectIntoTab,
  registerAlwaysLogScriptsForHost,
  unregisterAlwaysLogScriptsForHost,
} from '../content-scripts'
import { evaluateConsent } from '../consent'
import {
  getOrCreateTabState,
  setMode,
  updateIconForTab,
} from '../tab-state'
import {
  detachFromTab,
  isAttached as isDebuggerAttached,
} from '../../capture/debugger-capture'
import { browser } from '../../browser-apis'
import type {
  AlwaysLogHost,
  AlwaysLogHostsResponse,
} from '../../types/messages'

export async function handleAddAlwaysLog(host: string): Promise<{ ok: true }> {
  await addAlwaysLogHost(host)
  await registerAlwaysLogScriptsForHost(host)

  try {
    const tabs = await browser.tabs.query({})
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || !tab.url) {
        continue
      }

      try {
        const parsedUrl = new URL(tab.url)
        if (parsedUrl.hostname === host) {
          const consent = await evaluateConsent(tab.id, tab.url)
          if (consent.hasConsent) {
            const current = getOrCreateTabState(tab.id)
            if (current.mode === 'inactive') {
              await setMode(tab.id, 'content-script')
              updateIconForTab(tab.id)

              try {
                await injectIntoTab(tab.id)
              } catch (error) {
                console.error(`[Loggy] Failed to inject into tab ${tab.id}:`, error)
              }

              await browser.tabs.sendMessage(tab.id, {
                type: 'consent-changed',
                hasConsent: true,
                captureMode: 'content-script',
              }).catch(() => undefined)
            }
          }
        }
      } catch {
        // Invalid URL
      }
    }
  } catch {
    // Failed to query tabs
  }

  return { ok: true }
}

export async function handleRemoveAlwaysLog(host: string): Promise<{ ok: true }> {
  await removeAlwaysLogHost(host)
  await unregisterAlwaysLogScriptsForHost(host)

  try {
    const tabs = await browser.tabs.query({})
    for (const tab of tabs) {
      if (typeof tab.id !== 'number' || !tab.url) {
        continue
      }

      try {
        const parsedUrl = new URL(tab.url)
        if (parsedUrl.hostname === host) {
          const consent = await evaluateConsent(tab.id, tab.url)
          if (!consent.hasConsent) {
            const current = getOrCreateTabState(tab.id)
            if (current.mode !== 'devtools' && current.mode !== 'inactive') {
              if (current.mode === 'debugger' && isDebuggerAttached(tab.id)) {
                detachFromTab(tab.id)
              }

              await setMode(tab.id, 'inactive')
              updateIconForTab(tab.id)

              await browser.tabs.sendMessage(tab.id, {
                type: 'consent-changed',
                hasConsent: false,
                captureMode: 'none',
              }).catch(() => undefined)
            }
          }
        }
      } catch {
        // Invalid URL
      }
    }
  } catch {
    // Failed to query tabs
  }

  return { ok: true }
}

export async function handleGetAlwaysLogHosts(): Promise<AlwaysLogHostsResponse> {
  const hosts: AlwaysLogHost[] = await getAlwaysLogHosts()
  return { type: 'always-log-hosts-response', hosts } as AlwaysLogHostsResponse
}
