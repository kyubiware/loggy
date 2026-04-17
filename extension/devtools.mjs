import { browser } from './browser-apis/index.js'
import { CONSOLE_BOOTSTRAP_SCRIPT } from './utils/console-bootstrap.mjs'

const consoleCaptureBootstrapScript = CONSOLE_BOOTSTRAP_SCRIPT

function installConsoleCapture() {
  browser.devtools.inspectedWindow.eval(consoleCaptureBootstrapScript, (_result, isException) => {
    if (isException) {
      console.warn('Loggy console bootstrap failed:', isException)
    }
  })
}

function clearConsoleCaptureLogs() {
  browser.devtools.inspectedWindow.eval(
    'window.__loggyConsoleLogs = [];',
    (_result, isException) => {
      if (isException) {
        console.warn('Loggy console clear failed:', isException)
      }
    }
  )
}

function handleNavigation() {
  clearConsoleCaptureLogs()
  installConsoleCapture()
}

installConsoleCapture()
browser.devtools.network.onNavigated.addListener(handleNavigation)

// Create the Loggy panel in the current extension package
const panelPath = 'panel/index.html'
browser.devtools.panels.create('Loggy', 'icons/icon16.png', panelPath, () => {})
