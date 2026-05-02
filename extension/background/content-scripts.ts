const CONSOLE_BOOTSTRAP_FILE = 'chunks/console-bootstrap.js'
const CONTENT_RELAY_FILE = 'content-relay.js'
const SCRIPT_IDS = ['loggy-console-bootstrap', 'loggy-content-relay']

export async function areContentScriptsRegistered(): Promise<boolean> {
  const registered = await chrome.scripting.getRegisteredContentScripts()
  return registered.some((s) => s.id === SCRIPT_IDS[0])
}

export async function registerContentScripts(): Promise<void> {
  if (await areContentScriptsRegistered()) {
    return
  }

  await chrome.scripting.registerContentScripts([
    {
      id: 'loggy-console-bootstrap',
      js: [CONSOLE_BOOTSTRAP_FILE],
      matches: ['<all_urls>'],
      runAt: 'document_start',
      world: 'MAIN',
    },
    {
      id: 'loggy-content-relay',
      js: [CONTENT_RELAY_FILE],
      matches: ['<all_urls>'],
      runAt: 'document_start',
    },
  ])
}

export async function unregisterContentScripts(): Promise<void> {
  await chrome.scripting.unregisterContentScripts({ ids: SCRIPT_IDS })
}

export async function injectIntoTab(tabId: number): Promise<void> {
  const scripts = [
    { file: CONTENT_RELAY_FILE },
    { file: CONSOLE_BOOTSTRAP_FILE, world: 'MAIN' as const },
  ]

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
