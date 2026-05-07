declare const __BROWSER__: string

const CONSOLE_BOOTSTRAP_FILE = 'chunks/console-bootstrap.js'
const CONTENT_RELAY_FILE = 'content-relay.js'
const FAB_UI_FILE = 'fab-ui.js'

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
