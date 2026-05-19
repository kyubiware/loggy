declare const __BROWSER__: string

const CONSOLE_BOOTSTRAP_FILE = 'chunks/console-bootstrap.js'
const CONTENT_RELAY_FILE = 'content-relay.js'
const FAB_UI_FILE = 'fab-ui.js'

function getSafeHostId(host: string): string {
  return host.replace(/\./g, '-')
}

export async function registerAlwaysLogScriptsForHost(host: string): Promise<void> {
  const safeHostId = getSafeHostId(host)
  const relayId = `loggy-relay-${safeHostId}`
  const mainId = `loggy-main-${safeHostId}`
  const matches = [`*://${host}/*`]

  const scripts: chrome.scripting.RegisteredContentScript[] = [
    {
      id: relayId,
      matches,
      js: [CONTENT_RELAY_FILE],
      runAt: 'document_start',
    },
    {
      id: mainId,
      matches,
      js: [CONSOLE_BOOTSTRAP_FILE],
      runAt: 'document_start',
      world: 'MAIN',
    },
  ]

  if (__BROWSER__ === 'firefox') {
    const fabId = `loggy-fab-${safeHostId}`
    scripts.push({
      id: fabId,
      matches,
      js: [FAB_UI_FILE],
      runAt: 'document_start',
    })
  }

  try {
    await chrome.scripting.unregisterContentScripts({ ids: scripts.map((script) => script.id) })
  } catch {
    // Scripts may not exist yet
  }

  try {
    await chrome.scripting.registerContentScripts(scripts)
  } catch (error) {
    console.error(`[Loggy] Failed to register content scripts for host ${host}:`, error)
  }
}

export async function unregisterAlwaysLogScriptsForHost(host: string): Promise<void> {
  const safeHostId = getSafeHostId(host)
  const relayId = `loggy-relay-${safeHostId}`
  const mainId = `loggy-main-${safeHostId}`
  const ids = [relayId, mainId]

  if (__BROWSER__ === 'firefox') {
    const fabId = `loggy-fab-${safeHostId}`
    ids.push(fabId)
  }

  try {
    await chrome.scripting.unregisterContentScripts({ ids })
  } catch {
    // Scripts may not be registered
  }
}

export async function syncAllAlwaysLogScripts(hosts: string[]): Promise<void> {
  try {
    const registered = await chrome.scripting.getRegisteredContentScripts()
    const expectedIds = new Set<string>()

    for (const host of hosts) {
      const safeHostId = getSafeHostId(host)
      expectedIds.add(`loggy-relay-${safeHostId}`)
      expectedIds.add(`loggy-main-${safeHostId}`)
      if (__BROWSER__ === 'firefox') {
        expectedIds.add(`loggy-fab-${safeHostId}`)
      }
    }

    const loggyPrefixes = ['loggy-relay-', 'loggy-main-', 'loggy-fab-']
    const orphanedIds = registered
      .filter((script) => loggyPrefixes.some((prefix) => script.id.startsWith(prefix)))
      .filter((script) => !expectedIds.has(script.id))
      .map((script) => script.id)

    if (orphanedIds.length > 0) {
      try {
        await chrome.scripting.unregisterContentScripts({ ids: orphanedIds })
      } catch (error) {
        console.error('[Loggy] Failed to unregister orphaned content scripts:', error)
      }
    }

    for (const host of hosts) {
      await registerAlwaysLogScriptsForHost(host)
    }
  } catch (error) {
    console.error('[Loggy] Failed to sync always-log content scripts:', error)
  }
}

export async function injectIntoTab(tabId: number): Promise<void> {
  const scripts = [
    { file: CONTENT_RELAY_FILE },
    { file: CONSOLE_BOOTSTRAP_FILE, world: 'MAIN' as const },
  ]

  if (__BROWSER__ === 'firefox') {
    scripts.push({ file: FAB_UI_FILE })
  }

  for (const script of scripts) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [script.file],
        ...(script.world ? { world: script.world } : {}),
      })
    } catch (error) {
      console.error(`[Loggy] Failed to inject ${script.file}:`, error)
    }
  }
}
