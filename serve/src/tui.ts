import type { FastifyInstance } from 'fastify'
import { networkInterfaces } from 'node:os'
import readline from 'node:readline'

import { copyToClipboard } from './clipboard.js'

function getLanIP(): string | null {
  const interfaces = networkInterfaces()

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue

    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address
      }
    }
  }

  return null
}

interface TUIOptions {
  port: number
  host?: string
  domain?: string
  isHttps?: boolean
}

type ExportState = FastifyInstance['loggyState']

let isActive = false
let currentServer: FastifyInstance | null = null
let currentOptions: TUIOptions | null = null
let transientMessage: string | null = null
let transientTimer: NodeJS.Timeout | null = null
let lastRenderedLine: string | null = null

let onExportReceived: ((state: ExportState) => void) | null = null
let onStdinData: ((chunk: string) => void) | null = null
let onSigint: (() => void) | null = null
let onSigterm: (() => void) | null = null
let onUncaughtException: ((error: unknown) => void) | null = null
let onExit: (() => void) | null = null

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`
}

function formatTimeAgo(timestamp: number): string {
  const elapsedMs = Date.now() - timestamp

  if (elapsedMs < 1000) {
    return 'just now'
  }

  const seconds = Math.floor(elapsedMs / 1000)

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.floor(seconds / 60)

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getServerAddress(options: TUIOptions): string {
  if (options.isHttps && options.domain) {
    return `https://${options.domain}:${options.port} · localhost:${options.port}`
  }

  const host = options.host ?? '0.0.0.0'
  if (host === '127.0.0.1') {
    return `localhost:${options.port}`
  }

  if (host === '0.0.0.0') {
    const lanIP = getLanIP()
    return lanIP ? `localhost:${options.port} (${lanIP}:${options.port})` : `localhost:${options.port}`
  }

  return `${host}:${options.port}`
}

function buildStatusLine(server: FastifyInstance, options: TUIOptions): string {
  const address = getServerAddress(options)
  const hintOrMessage = transientMessage ?? '[c] copy  [q] quit'

  if (!server.loggyState.hasExport || server.loggyState.lastExportTime === null) {
    return `loggy-serve ●  ${address}  │  no exports yet  │  ${hintOrMessage}`
  }

  const exportCountLabel = server.loggyState.exportCount === 1 ? 'export' : 'exports'
  const exportCount = `${server.loggyState.exportCount} ${exportCountLabel}`
  const lastTime = formatTimeAgo(server.loggyState.lastExportTime)
  const size = formatBytes(server.loggyState.lastExportSize)

  return `loggy-serve ●  ${address}  │  ${exportCount}  │  last: ${lastTime} (${size})  │  ${hintOrMessage}`
}

function renderStatusBar(): void {
  if (!isActive || currentServer === null || currentOptions === null) {
    return
  }

  const line = buildStatusLine(currentServer, currentOptions)
  if (line === lastRenderedLine) {
    return
  }

  lastRenderedLine = line
  process.stdout.write(`\x1B[2K\r${line}`)
}

function showTransientMessage(message: string, durationMs = 2000): void {
  transientMessage = message
  renderStatusBar()

  if (transientTimer !== null) {
    clearTimeout(transientTimer)
  }

  transientTimer = setTimeout(() => {
    transientMessage = null
    transientTimer = null
    renderStatusBar()
  }, durationMs)
}

export function createTUI(server: FastifyInstance, options?: TUIOptions): void {
  if (!process.stdout.isTTY) {
    return
  }

  if (isActive) {
    return
  }

  const resolvedOptions: TUIOptions = {
    port: options?.port ?? 8743,
    host: options?.host ?? '0.0.0.0',
    domain: options?.domain,
    isHttps: options?.isHttps,
  }

  currentServer = server
  currentOptions = resolvedOptions
  isActive = true

  process.stdout.write('\x1B[?25l')

  readline.emitKeypressEvents(process.stdin)
  if (typeof process.stdin.setRawMode === 'function') {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  renderStatusBar()

  onExportReceived = () => {
    renderStatusBar()
  }
  server.loggyEmitter.on('export-received', onExportReceived)

  onStdinData = (chunk: string) => {
    if (!isActive) {
      return
    }

    if (chunk === 'q' || chunk === '\x03') {
      destroyTUI()
      process.exit(0)
    }

    if (chunk !== 'c') {
      return
    }

    if (!server.loggyState.hasExport) {
      showTransientMessage('No export yet')
      return
    }

    void (async () => {
      const copied = await copyToClipboard(server.loggyState.latestExport ?? '')
      showTransientMessage(copied ? 'Copied!' : 'Copy failed')
    })()
  }
  process.stdin.on('data', onStdinData)

  onSigint = () => {
    destroyTUI()
    process.exit(0)
  }
  onSigterm = () => {
    destroyTUI()
    process.exit(0)
  }
  onUncaughtException = (error: unknown) => {
    destroyTUI()
    throw error
  }
  onExit = () => {
    destroyTUI()
  }

  process.on('SIGINT', onSigint)
  process.on('SIGTERM', onSigterm)
  process.on('uncaughtException', onUncaughtException)
  process.on('exit', onExit)


}

export function destroyTUI(): void {
  if (!isActive) {
    return
  }

  isActive = false

  if (transientTimer !== null) {
    clearTimeout(transientTimer)
    transientTimer = null
  }

  const server = currentServer

  if (server !== null && onExportReceived !== null) {
    server.loggyEmitter.off('export-received', onExportReceived)
  }

  if (onStdinData !== null) {
    process.stdin.off('data', onStdinData)
  }

  if (onSigint !== null) {
    process.off('SIGINT', onSigint)
  }

  if (onSigterm !== null) {
    process.off('SIGTERM', onSigterm)
  }

  if (onUncaughtException !== null) {
    process.off('uncaughtException', onUncaughtException)
  }

  if (onExit !== null) {
    process.off('exit', onExit)
  }

  if (typeof process.stdin.setRawMode === 'function') {
    process.stdin.setRawMode(false)
  }

  process.stdout.write('\x1B[?25h')
  process.stdout.write('\x1B[2K\r')

  currentServer = null
  currentOptions = null
  transientMessage = null
  lastRenderedLine = null
  onExportReceived = null
  onStdinData = null
  onSigint = null
  onSigterm = null
  onUncaughtException = null
  onExit = null
}
