#!/usr/bin/env node

import { createTUI, destroyTUI } from './tui.js'
import { createServer, formatStartupError } from './server.js'

function parseArgs(argv: string[]) {
  const args = argv.slice(2)
  let port = 8743
  let outputPath: string | undefined
  let quiet = false
  let subcommand: string | undefined

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

    if (!arg.startsWith('--') && !subcommand) {
      if (arg === 'print') {
        subcommand = 'print'
        continue
      }

      throw new Error(`Unknown command: ${arg}`)
    }

    throw new Error(`Unknown flag: ${arg}`)
  }

  return { port, outputPath, quiet, subcommand }
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

async function main() {
  const { port, outputPath, quiet, subcommand } = parseArgs(process.argv)

  if (subcommand === 'print') {
    await printLatestExport(port)
    return
  }

  const app = createServer({ outputPath })

  try {
    await app.listen({ port, host: '0.0.0.0' })

    const useTUI = !quiet && !!process.stdout.isTTY

    if (useTUI) {
      createTUI(app, { port })
    } else {
      console.log(`loggy-serve listening on http://localhost:${port}`)
    }

    const shutdown = async () => {
      destroyTUI()
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
