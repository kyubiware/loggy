import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { clipboardWriteMock } = vi.hoisted(() => ({
  clipboardWriteMock: vi.fn<(text: string) => Promise<void>>(),
}))

vi.mock('clipboardy', () => ({
  default: {
    write: clipboardWriteMock,
    read: vi.fn(),
  },
}))

import { copyToClipboard } from '../src/clipboard.js'
import * as clipboardModule from '../src/clipboard.js'
import { createServer } from '../src/server.js'
import { createTUI, destroyTUI } from '../src/tui.js'

const appsToClose: Array<ReturnType<typeof createServer>> = []

type StdinWithRawMode = NodeJS.ReadStream & {
  setRawMode?: (mode: boolean) => void
}

const stdin = process.stdin as StdinWithRawMode
const originalStdoutIsTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
const originalSetRawMode = stdin.setRawMode

let stdinDataHandler: ((chunk: string) => void) | null = null
let setRawModeSpy: ReturnType<typeof vi.fn<(mode: boolean) => void>>
let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

function setStdoutTTY(value: boolean): void {
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value,
  })
}

function getWrittenOutput(writeSpy: ReturnType<typeof vi.spyOn>): string {
  const calls = writeSpy.mock.calls as Array<[unknown, ...unknown[]]>
  return calls.map((call) => String(call[0])).join('')
}

beforeEach(() => {
  stdinDataHandler = null
  setRawModeSpy = vi.fn<(mode: boolean) => void>()
  stdin.setRawMode = setRawModeSpy as unknown as typeof stdin.setRawMode

  stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  vi.spyOn(process.stdin, 'resume').mockImplementation(() => process.stdin)
  vi.spyOn(process.stdin, 'setEncoding').mockImplementation(() => process.stdin)
  vi.spyOn(process.stdin, 'on').mockImplementation((event: string, handler: (chunk: string) => void) => {
    if (event === 'data') {
      stdinDataHandler = handler
    }

    return process.stdin
  })
  vi.spyOn(process.stdin, 'off').mockImplementation(() => process.stdin)
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as unknown as typeof process.exit)

  clipboardWriteMock.mockReset()
})

afterEach(async () => {
  destroyTUI()

  await Promise.all(appsToClose.splice(0).map((app) => app.close()))

  if (originalStdoutIsTTY) {
    Object.defineProperty(process.stdout, 'isTTY', originalStdoutIsTTY)
  }

  stdin.setRawMode = originalSetRawMode
  vi.restoreAllMocks()
})

describe('clipboard', () => {
  it('copyToClipboard returns true on success', async () => {
    clipboardWriteMock.mockResolvedValue(undefined)

    await expect(copyToClipboard('hello')).resolves.toBe(true)
  })

  it('copyToClipboard returns false when clipboardy throws', async () => {
    clipboardWriteMock.mockRejectedValue(new Error('clipboard unavailable'))

    await expect(copyToClipboard('hello')).resolves.toBe(false)
  })

  it('copyToClipboard passes correct text to clipboardy', async () => {
    clipboardWriteMock.mockResolvedValue(undefined)

    await copyToClipboard('specific text')

    expect(clipboardWriteMock).toHaveBeenCalledWith('specific text')
  })
})

describe('tui', () => {
  it('createTUI does nothing when stdout is not a TTY', () => {
    const app = createServer()
    appsToClose.push(app)

    setStdoutTTY(false)
    createTUI(app, { port: 8743 })

    expect(setRawModeSpy).not.toHaveBeenCalled()
    expect(stdoutWriteSpy).not.toHaveBeenCalled()
  })

  it('createTUI enables raw mode and hides cursor when TTY', () => {
    const app = createServer()
    appsToClose.push(app)

    setStdoutTTY(true)
    createTUI(app, { port: 8743 })

    expect(setRawModeSpy).toHaveBeenCalledWith(true)
    expect(getWrittenOutput(stdoutWriteSpy)).toContain('\x1B[?25l')
  })

  it('createTUI renders initial status bar with server URL', () => {
    const app = createServer()
    appsToClose.push(app)

    setStdoutTTY(true)
    createTUI(app, { port: 9999, host: '127.0.0.1' })

    expect(getWrittenOutput(stdoutWriteSpy)).toContain('localhost:9999')
  })

  it('Status bar updates on export-received event', () => {
    const app = createServer()
    appsToClose.push(app)

    setStdoutTTY(true)
    createTUI(app, { port: 8743 })

    app.loggyState.exportCount = 1
    app.loggyState.lastExportTime = Date.now()
    app.loggyState.lastExportSize = 12
    app.loggyState.hasExport = true
    app.loggyState.latestExport = '# Markdown\n'
    app.loggyEmitter.emit('export-received', app.loggyState)

    const output = getWrittenOutput(stdoutWriteSpy)
    expect(output).toContain('1 export')
    expect(output).toContain('(12 B)')
  })

  it("Pressing 'c' calls copyToClipboard with latest export", async () => {
    const app = createServer()
    appsToClose.push(app)
    const copySpy = vi.spyOn(clipboardModule, 'copyToClipboard')

    clipboardWriteMock.mockResolvedValue(undefined)
    app.loggyState.hasExport = true
    app.loggyState.latestExport = '# Latest Export'

    setStdoutTTY(true)
    createTUI(app, { port: 8743 })
    expect(stdinDataHandler).toBeTruthy()

    stdinDataHandler?.('c')

    await Promise.resolve()
    await Promise.resolve()

    expect(copySpy).toHaveBeenCalledWith('# Latest Export')
  })

  it("Pressing 'c' with no export shows message", () => {
    const app = createServer()
    appsToClose.push(app)

    setStdoutTTY(true)
    createTUI(app, { port: 8743 })
    expect(stdinDataHandler).toBeTruthy()

    stdinDataHandler?.('c')

    expect(getWrittenOutput(stdoutWriteSpy)).toContain('No export yet')
  })

  it("Pressing 'q' calls destroyTUI and exits", () => {
    const app = createServer()
    appsToClose.push(app)
    const exitSpy = vi.spyOn(process, 'exit')

    setStdoutTTY(true)
    createTUI(app, { port: 8743 })
    expect(stdinDataHandler).toBeTruthy()

    stdinDataHandler?.('q')

    expect(setRawModeSpy).toHaveBeenCalledWith(false)
    expect(getWrittenOutput(stdoutWriteSpy)).toContain('\x1B[?25h')
    expect(exitSpy).toHaveBeenCalledWith(0)
  })

  it('destroyTUI restores cursor and disables raw mode', () => {
    const app = createServer()
    appsToClose.push(app)
    const stdoutWriteSpy = vi.spyOn(process.stdout, 'write')

    setStdoutTTY(true)
    createTUI(app, { port: 8743 })
    destroyTUI()

    expect(setRawModeSpy).toHaveBeenCalledWith(false)
    expect(getWrittenOutput(stdoutWriteSpy)).toContain('\x1B[?25h')
  })

  it('destroyTUI is idempotent', () => {
    const app = createServer()
    appsToClose.push(app)

    setStdoutTTY(true)
    createTUI(app, { port: 8743 })

    expect(() => {
      destroyTUI()
      destroyTUI()
    }).not.toThrow()
  })
})
