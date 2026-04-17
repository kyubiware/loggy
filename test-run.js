#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createServer as createNetServer } from 'node:net'
import { request as httpRequest } from 'node:http'
import path from 'node:path'

const HANDSHAKE_PATH = '/loggy/handshake'
const POST_PATH = '/loggy'
const EXPORT_PATH = '/loggy/export'
const HOST = '127.0.0.1'

function logPass(message) {
  console.log(`✅ ${message}`)
}

function logFail(message, error) {
  console.error(`❌ ${message}`)
  if (error) {
    console.error(error)
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer()

    server.on('error', reject)
    server.listen(0, HOST, () => {
      const address = server.address()

      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to determine a free port')))
        return
      }

      server.close((closeError) => {
        if (closeError) {
          reject(closeError)
          return
        }

        resolve(address.port)
      })
    })
  })
}

function requestText({ method, host, port, pathName, body }) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        method,
        host,
        port,
        path: pathName,
        headers:
          body === undefined
            ? undefined
            : {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Length': Buffer.byteLength(body),
              },
      },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve({ statusCode: res.statusCode ?? 0, body: data })
        })
      }
    )

    req.on('error', reject)

    if (body !== undefined) {
      req.write(body)
    }

    req.end()
  })
}

async function waitForServerReady(port, timeoutMs = 10_000) {
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await requestText({
        method: 'GET',
        host: HOST,
        port,
        pathName: HANDSHAKE_PATH,
      })

      if (response.statusCode === 200) {
        return
      }
    } catch {
      // keep polling until timeout
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error('Server did not become ready before timeout')
}

async function run() {
  let child

  try {
    const port = await getFreePort()
    const serverScriptPath = path.resolve(process.cwd(), 'serve/bin/loggy-serve.js')

    child = spawn(process.execPath, [serverScriptPath, '--port', String(port)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout.on('data', (chunk) => process.stdout.write(`[serve] ${chunk}`))
    child.stderr.on('data', (chunk) => process.stderr.write(`[serve] ${chunk}`))

    await waitForServerReady(port)
    logPass(`Server ready on http://${HOST}:${port}`)

    const markdownOne = [
      '## Debug Log Export',
      '',
      '### Environment',
      '- **URL**: https://example.test/first',
      '- **Timestamp**: 2026-03-30T00:00:00.000Z',
      '',
      '### Console Logs',
      '| First Seen | Last Seen | Level | Count | Message |',
      '|------------|-----------|-------|-------|---------|',
      '| 00:00:00 | 00:00:00 | error | 1 | First export failure |',
      '',
    ].join('\n')

    const postOne = await requestText({
      method: 'POST',
      host: HOST,
      port,
      pathName: POST_PATH,
      body: markdownOne,
    })

    if (postOne.statusCode !== 200) {
      throw new Error(`First POST failed (${postOne.statusCode}): ${postOne.body}`)
    }
    logPass('First POST accepted')

    const getOne = await requestText({
      method: 'GET',
      host: HOST,
      port,
      pathName: EXPORT_PATH,
    })

    if (getOne.statusCode !== 200 || getOne.body !== markdownOne) {
      throw new Error(
        `First GET mismatch. status=${getOne.statusCode} expected body length=${markdownOne.length} actual length=${getOne.body.length}`
      )
    }
    logPass('GET /loggy/export returned first posted content')

    const markdownTwo = [
      '## Debug Log Export',
      '',
      '### Environment',
      '- **URL**: https://example.test/second',
      '- **Timestamp**: 2026-03-30T00:01:00.000Z',
      '',
      '### Network Requests',
      '- GET https://api.example.test/fail -> 500',
      '',
    ].join('\n')

    const postTwo = await requestText({
      method: 'POST',
      host: HOST,
      port,
      pathName: POST_PATH,
      body: markdownTwo,
    })

    if (postTwo.statusCode !== 200) {
      throw new Error(`Second POST failed (${postTwo.statusCode}): ${postTwo.body}`)
    }
    logPass('Second POST accepted')

    const getTwo = await requestText({
      method: 'GET',
      host: HOST,
      port,
      pathName: EXPORT_PATH,
    })

    if (getTwo.statusCode !== 200 || getTwo.body !== markdownTwo) {
      throw new Error(
        `Second GET mismatch. status=${getTwo.statusCode} expected body length=${markdownTwo.length} actual length=${getTwo.body.length}`
      )
    }
    logPass('GET /loggy/export returned replacement content after second POST')

    logPass('E2E export flow test passed')
    process.exitCode = 0
  } catch (error) {
    logFail('E2E export flow test failed', error)
    process.exitCode = 1
  } finally {
    if (child && !child.killed) {
      child.kill('SIGTERM')
      await new Promise((resolve) => {
        child.once('exit', resolve)
        setTimeout(resolve, 1_500)
      })
      logPass('Server process cleaned up')
    }
  }
}

void run()
