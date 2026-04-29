import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer } from '../src/server.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'))

const appsToClose: Array<ReturnType<typeof createServer>> = []

afterEach(async () => {
  await Promise.all(appsToClose.splice(0).map((app) => app.close()))
})

describe('loggy-serve endpoints', () => {
  it('returns handshake payload', async () => {
    const app = createServer()
    appsToClose.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/loggy/handshake',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      version: pkg.version,
      name: 'loggy-serve',
    })
  })

  it('returns 404 when no export has been posted yet', async () => {
    const app = createServer()
    appsToClose.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/loggy/export',
    })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'No export available' })
  })

  it('stores markdown from POST and returns it from GET', async () => {
    const app = createServer()
    appsToClose.push(app)

    const markdown = '# Hello'
    const postResponse = await app.inject({
      method: 'POST',
      url: '/loggy',
      payload: markdown,
      headers: {
        'content-type': 'text/plain',
      },
    })

    expect(postResponse.statusCode).toBe(200)
    expect(postResponse.json()).toEqual({ ok: true })

    const getResponse = await app.inject({
      method: 'GET',
      url: '/loggy/export',
    })

    expect(getResponse.statusCode).toBe(200)
    expect(getResponse.body).toBe(markdown)
    expect(getResponse.headers['content-type']).toContain('text/plain')
  })

  it('replaces previous export on second POST', async () => {
    const app = createServer()
    appsToClose.push(app)

    await app.inject({
      method: 'POST',
      url: '/loggy',
      payload: '# First',
      headers: {
        'content-type': 'text/plain',
      },
    })

    await app.inject({
      method: 'POST',
      url: '/loggy',
      payload: '# Second',
      headers: {
        'content-type': 'text/plain',
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/loggy/export',
    })

    expect(response.statusCode).toBe(200)
    expect(response.body).toBe('# Second')
  })

  it('applies CORS headers for cross-origin requests', async () => {
    const app = createServer()
    appsToClose.push(app)

    const response = await app.inject({
      method: 'GET',
      url: '/loggy/handshake',
      headers: {
        origin: 'chrome-extension://abc123',
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['access-control-allow-origin']).toBe('*')
  })

  it('writes export content to output file when configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'loggy-serve-test-'))
    const outputPath = join(dir, 'export.md')
    const app = createServer({ outputPath })
    appsToClose.push(app)

    await app.inject({
      method: 'POST',
      url: '/loggy',
      payload: '# Persisted',
      headers: {
        'content-type': 'text/plain',
      },
    })

    const fileContents = await readFile(outputPath, 'utf8')
    expect(fileContents).toBe('# Persisted')

    await rm(dir, { recursive: true, force: true })
  })
})
