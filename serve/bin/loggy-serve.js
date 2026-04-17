#!/usr/bin/env node

import { createTUI, destroyTUI } from '../dist/tui.js'
import { createServer, formatStartupError } from '../dist/server.js'

function parseArgs(argv) {
  const args = argv.slice(2)
  let port = 8743
  let outputPath
  let quiet = false

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

    throw new Error(`Unknown flag: ${arg}`)
  }

  return { port, outputPath, quiet }
}

async function main() {
  const { port, outputPath, quiet } = parseArgs(process.argv)
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
