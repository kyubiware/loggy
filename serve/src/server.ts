import cors from '@fastify/cors'
import Fastify, { type FastifyInstance } from 'fastify'
import { writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { EventEmitter } from 'node:events'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))

export interface LoggyState {
  exportCount: number
  lastExportTime: number | null
  lastExportSize: number
  hasExport: boolean
  latestExport: string | null
}

declare module 'fastify' {
  interface FastifyInstance {
    loggyState: LoggyState
    loggyEmitter: EventEmitter
  }
}

export interface ServerOptions {
  outputPath?: string
  https?: { key: Buffer; cert: Buffer }
}

export interface StartServerOptions extends ServerOptions {
  port?: number
  host?: string
}

const HANDSHAKE_PAYLOAD = {
  version: pkg.version,
  name: 'loggy-serve',
}

export function createServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({
    bodyLimit: 52_428_800,
    ...(options.https && { https: options.https }),
  })
  let latestExport: string | null = null
  const loggyState: LoggyState = {
    exportCount: 0,
    lastExportTime: null,
    lastExportSize: 0,
    hasExport: false,
    latestExport: null,
  }
  const loggyEmitter = new EventEmitter()

  app.decorate('loggyState', loggyState)
  app.decorate('loggyEmitter', loggyEmitter)

  app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
  })

  app.post('/loggy', async (request, reply) => {
    const body = request.body

    if (typeof body !== 'string') {
      reply.code(400)
      return { error: 'Request body must be text/plain' }
    }

    latestExport = body
    loggyState.exportCount += 1
    loggyState.lastExportTime = Date.now()
    loggyState.lastExportSize = body.length
    loggyState.hasExport = true
    loggyState.latestExport = body

    if (options.outputPath) {
      await writeFile(options.outputPath, body, 'utf8')
    }

    loggyEmitter.emit('export-received', loggyState)

    return { ok: true }
  })

  app.get('/loggy/handshake', async () => {
    return HANDSHAKE_PAYLOAD
  })

  app.get('/loggy/export', async (request, reply) => {
    void request

    if (latestExport === null) {
      reply.code(404)
      return { error: 'No export available' }
    }

    reply.type('text/plain; charset=utf-8')
    return latestExport
  })

  return app
}

export async function startServer(options: StartServerOptions = {}): Promise<FastifyInstance> {
  const app = createServer(options)
  const port = options.port ?? 8743
  const host = options.host ?? '0.0.0.0'

  try {
    await app.listen({ port, host })
    return app
  } catch (error) {
    await app.close()
    throw error
  }
}

export function formatStartupError(error: unknown, port: number): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'EADDRINUSE'
  ) {
    return `Port ${port} is already in use. Stop the other process or run loggy-serve --port <another-port>.`
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown startup error'
}
