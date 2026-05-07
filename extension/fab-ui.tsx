/// <reference path="./css-inline.d.ts" />

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import styles from './fab/fab.css?inline'
import { FabContainer } from './fab/FabContainer'

async function isFirefoxAndroid(): Promise<boolean> {
  try {
    const info = await chrome.runtime.getPlatformInfo()
    return info.os === 'android'
  } catch {
    return false
  }
}

function mountFab(): void {
  const existingHost = document.getElementById('loggy-fab-host')
  if (existingHost) return

  const host = document.createElement('div')
  host.id = 'loggy-fab-host'
  host.style.cssText = 'position:fixed;z-index:2147483647;top:0;left:0;width:0;height:0;'
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })

  const styleEl = document.createElement('style')
  styleEl.textContent = styles
  shadow.appendChild(styleEl)

  const mountPoint = document.createElement('div')
  mountPoint.id = 'loggy-fab-root'
  shadow.appendChild(mountPoint)

  const root = createRoot(mountPoint)
  root.render(
    <StrictMode>
      <FabContainer />
    </StrictMode>,
  )
}

async function init(): Promise<void> {
  const isAndroid = await isFirefoxAndroid()
  if (!isAndroid) return

  if (document.body) {
    mountFab()
  } else {
    document.addEventListener('DOMContentLoaded', mountFab)
  }
}

init()
