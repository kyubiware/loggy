#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import updateNotifier from 'update-notifier'
import { networkInterfaces } from 'node:os'
import { execSync } from 'node:child_process'
import readline from 'node:readline'
import { createTUI, destroyTUI } from './tui.js'
import { createServer, formatStartupError } from './server.js'
import type { FastifyInstance } from 'fastify'
import { detectTailscale, getTailscaleCerts } from './tailscale.js'
import type { TailscaleCertInfo } from './tailscale.js'

async function resolveTailscaleIP(): Promise<string | null> {
  try {
    const ip = execSync('tailscale ip -4', { timeout: 3000, encoding: 'utf8' }).trim()
    return ip || null
  } catch {
    return null
  }
}

function getLanIPs(): string[] {
  const interfaces = networkInterfaces()
  const ips: string[] = []

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue

    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        ips.push(entry.address)
      }
    }
  }

  return ips
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))

function parseArgs(argv: string[]): {
  port: number
  outputPath?: string
  quiet: boolean
  subcommand?: string
  https: boolean | undefined
} {
  const args = argv.slice(2)
  let port = 8743
  let outputPath: string | undefined
  let quiet = false
  let subcommand: string | undefined
  let https: boolean | undefined

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]

    if (arg === '--port') {
      const value = args[i + 1]
      if (!value) {
        throw new Error('Missing value for --port')
      }

      const parsedPort = Number.parseInt(value, 10)
      if (Number.isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65_535) {
        throw new Error(`Invalid port: ${value}`)
      }

      port = parsedPort
      i += 1
      continue
    }

    if (arg === '--output') {
      const value = args[i + 1]
      if (!value) {
        throw new Error('Missing value for --output')
      }

      outputPath = value
      i += 1
      continue
    }

    if (arg === '--quiet' || arg === '--no-interactive') {
      quiet = true
      continue
    }

    if (arg === '--https') {
      https = true
      continue
    }

    if (arg === '--no-https') {
      https = false
      continue
    }

    if (!arg.startsWith('--') && !subcommand) {
      if (arg === 'print') {
        subcommand = 'print'
        continue
      }

      throw new Error(`Unknown command: ${arg}`)
    }

    throw new Error(`Unknown flag: ${arg}`)
  }

  return { port, outputPath, quiet, subcommand, https }
}

async function printLatestExport(port: number) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/loggy/export`)

    if (response.status === 404) {
      console.error('No export available yet. Send logs from the browser extension first.')
      process.exit(1)
    }

    if (!response.ok) {
      console.error(`Error: loggy-serve returned HTTP ${response.status}`)
      process.exit(1)
    }

    process.stdout.write(await response.text())
  } catch {
    console.error('Error: loggy-serve is not running. Start it first with: loggy')
    process.exit(1)
  }
}

function promptYesNo(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question(`${question} (y/N) `, (answer) => {
      rl.close()
      const normalized = answer.trim().toLowerCase()
      resolve(normalized === 'y' || normalized === 'yes')
    })
  })
}

function printTailscaleCertHelp(hostname: string): void {
  console.log('')
  console.log('  Tailscale detected but HTTPS cert generation failed.')
  console.log('  To allow loggy to generate a cert, run:')
  console.log('')
  console.log(`    sudo tailscale set --operator=$USER`)
  console.log('')
  console.log('  This grants your user access to Tailscale certs without root.')
  console.log(`  After that, loggy will use https://${hostname} automatically.`)
  console.log('')
}

async function main() {
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    console.log(pkg.version)
    process.exit(0)
  }

  const notifier = updateNotifier({ pkg })
  notifier.notify({ defer: true })

  const { port, outputPath, quiet, subcommand, https } = parseArgs(process.argv)

  if (subcommand === 'print') {
    await printLatestExport(port)
    return
  }

  let httpsConfig: TailscaleCertInfo | undefined
  let isHttps = false
  let tailscaleDomain: string | undefined

  if (https === false) {
    httpsConfig = undefined
  } else if (https === true) {
    const certs = getTailscaleCerts()
    if (!certs) {
      throw new Error(
        'Tailscale HTTPS requested but Tailscale is not available. Make sure Tailscale is running and HTTPS certs are enabled for your tailnet.',
      )
    }

    isHttps = true
    httpsConfig = certs
    tailscaleDomain = certs.hostname
  } else {
    const detection = detectTailscale()

    if (detection.certs) {
      isHttps = true
      httpsConfig = detection.certs
      tailscaleDomain = detection.certs.hostname
    } else if (detection.certError && process.stdout.isTTY) {
      const { hostname, message } = detection.certError

      printTailscaleCertHelp(hostname)
      console.log(`  Error: ${message}`)
      console.log('')

      const proceed = await promptYesNo('  Start without HTTPS for now?')
      if (!proceed) {
        process.exit(0)
      }

      console.log('')
    }
  }

  const app = createServer({ outputPath, https: httpsConfig })

  // When HTTPS is active, also start a plain HTTP listener on localhost
  // so local clients (curl, scripts) can still connect without TLS.
  let localhostApp: FastifyInstance | undefined

  try {
    if (isHttps) {
      // Bind HTTPS to the Tailscale interface so 127.0.0.1 stays free
      // for the plain HTTP localhost listener.
      const tailscaleIP = await resolveTailscaleIP()
      await app.listen({ port, host: tailscaleIP ?? '0.0.0.0' })

      localhostApp = createServer({ outputPath })
      localhostApp.loggyState = app.loggyState
      localhostApp.loggyEmitter = app.loggyEmitter
      await localhostApp.listen({ port, host: '127.0.0.1' })
    } else {
      await app.listen({ port, host: '0.0.0.0' })
    }

    const useTUI = !quiet && !!process.stdout.isTTY

    if (useTUI) {
      createTUI(app, { port, domain: tailscaleDomain, isHttps })
    } else {
      const lanIPs = getLanIPs()
      if (isHttps && tailscaleDomain) {
        console.log(`loggy-serve listening on https://${tailscaleDomain}:${port}`)
        console.log(`  http://localhost:${port}`)
      } else {
        console.log(`loggy-serve listening on http://localhost:${port}`)

        for (const ip of lanIPs) {
          console.log(`  http://${ip}:${port}`)
        }
      }
    }

    const shutdown = async () => {
      destroyTUI()
      await localhostApp?.close()
      await app.close()
      process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  } catch (error) {
    console.error(formatStartupError(error, port))
    process.exit(1)
  }
}

main()
