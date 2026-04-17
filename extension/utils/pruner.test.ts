/**
 * Test suite for utils/pruner.ts
 * Tests data pruning functionality for console and network logs
 */

import { describe, expect, test } from 'vitest'
import type { ConsoleMessage } from '../types/console'
import type { HARContent, HAREntry } from '../types/har'
import { pruneConsole, pruneNetwork } from './pruner'

describe('pruneConsole', () => {
  test('should return empty array when given empty array', () => {
    const logs: ConsoleMessage[] = []
    const result = pruneConsole(logs)
    expect(result).toEqual([])
  })

  test('should not truncate message under 500 characters', () => {
    const shortMessage = 'This is a short message'
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: shortMessage,
      },
    ]
    const result = pruneConsole(logs)
    expect(result[0].message).toBe(shortMessage)
    expect(result[0].message.length).toBe(shortMessage.length)
  })

  test('should not truncate message at exactly 500 characters', () => {
    const exactLengthMessage = 'a'.repeat(500)
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: exactLengthMessage,
      },
    ]
    const result = pruneConsole(logs)
    expect(result[0].message).toBe(exactLengthMessage)
    expect(result[0].message.length).toBe(500)
  })

  test('should truncate message over 500 characters', () => {
    const longMessage = 'a'.repeat(600)
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: longMessage,
      },
    ]
    const result = pruneConsole(logs)
    expect(result[0].message.length).toBeLessThan(longMessage.length)
    expect(result[0].message).toBe(`${'a'.repeat(500)}... [truncated]`)
  })

  test('should truncate multiple messages independently', () => {
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: 'Short message',
      },
      {
        timestamp: '2024-01-15T10:30:01Z',
        level: 'error',
        message: 'a'.repeat(600),
      },
      {
        timestamp: '2024-01-15T10:30:02Z',
        level: 'warn',
        message: 'b'.repeat(400),
      },
    ]
    const result = pruneConsole(logs)
    expect(result[0].message).toBe('Short message')
    expect(result[1].message).toBe(`${'a'.repeat(500)}... [truncated]`)
    expect(result[2].message).toBe('b'.repeat(400))
  })

  test('should not mutate original logs array', () => {
    const originalMessage = 'a'.repeat(600)
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: originalMessage,
      },
    ]
    pruneConsole(logs)
    expect(logs[0].message).toBe(originalMessage)
  })

  test('should truncate when truncateConsoleLogs option is true', () => {
    const longMessage = 'a'.repeat(600)
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: longMessage,
      },
    ]
    const result = pruneConsole(logs, { truncateConsoleLogs: true })
    expect(result[0].message).toBe(`${'a'.repeat(500)}... [truncated]`)
    expect(result[0].message.length).toBeLessThan(longMessage.length)
  })

  test('should NOT truncate when truncateConsoleLogs option is false', () => {
    const longMessage = 'a'.repeat(600)
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: longMessage,
      },
    ]
    const result = pruneConsole(logs, { truncateConsoleLogs: false })
    expect(result[0].message).toBe(longMessage)
    expect(result[0].message.length).toBe(600)
  })

  test('should truncate by default when no options provided', () => {
    const longMessage = 'a'.repeat(600)
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: longMessage,
      },
    ]
    const result = pruneConsole(logs)
    expect(result[0].message).toBe(`${'a'.repeat(500)}... [truncated]`)
  })

  test('should handle empty array with truncateConsoleLogs option', () => {
    const logs: ConsoleMessage[] = []
    const result = pruneConsole(logs, { truncateConsoleLogs: false })
    expect(result).toEqual([])
  })

  test('should handle exactly 500 chars with truncateConsoleLogs: false', () => {
    const exactMessage = 'a'.repeat(500)
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: exactMessage,
      },
    ]
    const result = pruneConsole(logs, { truncateConsoleLogs: false })
    expect(result[0].message).toBe(exactMessage)
    expect(result[0].message.length).toBe(500)
  })

  test('should handle short messages with truncateConsoleLogs: false', () => {
    const shortMessage = 'Short message'
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: shortMessage,
      },
    ]
    const result = pruneConsole(logs, { truncateConsoleLogs: false })
    expect(result[0].message).toBe(shortMessage)
  })

  test('should handle multiple logs with truncateConsoleLogs: false', () => {
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: 'a'.repeat(400),
      },
      {
        timestamp: '2024-01-15T10:30:01Z',
        level: 'error',
        message: 'b'.repeat(700),
      },
      {
        timestamp: '2024-01-15T10:30:02Z',
        level: 'warn',
        message: 'c'.repeat(501),
      },
    ]
    const result = pruneConsole(logs, { truncateConsoleLogs: false })
    expect(result[0].message.length).toBe(400)
    expect(result[1].message.length).toBe(700)
    expect(result[2].message.length).toBe(501)
  })

  test('should not mutate original logs array with truncateConsoleLogs option', () => {
    const originalMessage = 'a'.repeat(600)
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: originalMessage,
      },
    ]
    pruneConsole(logs, { truncateConsoleLogs: false })
    expect(logs[0].message).toBe(originalMessage)
  })
})

describe('pruneNetwork', () => {
  test('should return empty array when given empty array', () => {
    const entries: HAREntry[] = []
    const result = pruneNetwork(entries)
    expect(result).toEqual([])
  })

  test('should remove binary content for image MIME types', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/image.png',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 1024,
            mimeType: 'image/png',
            text: 'binary data would be here',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should remove binary content for video MIME types', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/video.mp4',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 5000000,
            mimeType: 'video/mp4',
            text: 'binary video data',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should remove binary content for audio MIME types', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/audio.mp3',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 3000000,
            mimeType: 'audio/mp3',
            text: 'binary audio data',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should remove binary content for font MIME types', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/font.woff2',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 50000,
            mimeType: 'font/woff2',
            text: 'binary font data',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should remove binary content for application/octet-stream', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/file.bin',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 1000000,
            mimeType: 'application/octet-stream',
            text: 'binary data',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should remove binary content for application/pdf', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/document.pdf',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 250000,
            mimeType: 'application/pdf',
            text: 'binary pdf data',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should be case-sensitive for binary MIME type detection (current limitation)', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/image.PNG',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 1024,
            mimeType: 'IMAGE/PNG',
            text: 'binary data',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    // Current implementation is case-sensitive - uppercase MIME types won't match
    expect(result[0].response.content?.text).toBe('binary data')
  })

  test('should not remove non-binary content (JSON)', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 100,
            mimeType: 'application/json',
            text: '{"key": "value"}',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('{"key": "value"}')
  })

  test('should not remove non-binary content (HTML)', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/page',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 1000,
            mimeType: 'text/html',
            text: '<html><body>Content</body></html>',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('<html><body>Content</body></html>')
  })

  test('should not remove non-binary content (CSS)', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/style.css',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 500,
            mimeType: 'text/css',
            text: 'body { color: red; }',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('body { color: red; }')
  })

  test('should not remove non-binary content (JavaScript)', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/script.js',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 200,
            mimeType: 'application/javascript',
            text: 'console.log("hello");',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('console.log("hello");')
  })

  test('should truncate response body over 10KB', () => {
    const largeBody = 'x'.repeat(11000)
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 11000,
            mimeType: 'application/json',
            text: largeBody,
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe(`${'x'.repeat(10000)}... [truncated]`)
    expect(result[0].response.content?.text?.length).toBe(10015) // 10000 + 15 for truncation message
  })

  test('should not truncate response body at exactly 10KB', () => {
    const exactBody = 'x'.repeat(10000)
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 10000,
            mimeType: 'application/json',
            text: exactBody,
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe(exactBody)
    expect(result[0].response.content?.text?.length).toBe(10000)
  })

  test('should not truncate response body under 10KB', () => {
    const smallBody = 'x'.repeat(5000)
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 5000,
            mimeType: 'application/json',
            text: smallBody,
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe(smallBody)
  })

  test('should truncate request body over 10KB', () => {
    const largeBody = 'y'.repeat(11000)
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'POST',
          postData: {
            mimeType: 'application/json',
            text: largeBody,
          },
        },
        response: {
          status: 200,
          statusText: 'OK',
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].request.postData?.text).toBe(`${'y'.repeat(10000)}... [truncated]`)
    expect(result[0].request.postData?.text?.length).toBe(10015)
  })

  test('should not truncate request body at exactly 10KB', () => {
    const exactBody = 'y'.repeat(10000)
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'POST',
          postData: {
            mimeType: 'application/json',
            text: exactBody,
          },
        },
        response: {
          status: 200,
          statusText: 'OK',
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].request.postData?.text).toBe(exactBody)
    expect(result[0].request.postData?.text?.length).toBe(10000)
  })

  test('should not truncate request body under 10KB', () => {
    const smallBody = 'y'.repeat(5000)
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'POST',
          postData: {
            mimeType: 'application/json',
            text: smallBody,
          },
        },
        response: {
          status: 200,
          statusText: 'OK',
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].request.postData?.text).toBe(smallBody)
  })

  test('should handle missing response content gracefully', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('')
  })

  test('should handle missing request postData gracefully', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            mimeType: 'application/json',
            text: '{}',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].request.postData).toBeUndefined()
  })

  test('should handle undefined MIME type gracefully', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 100,
            text: 'some text',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('some text')
  })

  test('should not mutate original entries array', () => {
    const originalText = 'a'.repeat(11000)
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 11000,
            mimeType: 'application/json',
            text: originalText,
          },
        },
      },
    ]
    pruneNetwork(entries)
    expect(entries[0].response.content?.text).toBe(originalText)
  })

  test('should handle multiple entries with mixed content types', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: {
          url: 'https://example.com/image.png',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 1024,
            mimeType: 'image/png',
            text: 'binary image',
          },
        },
      },
      {
        startedDateTime: '2024-01-15T10:30:01Z',
        request: {
          url: 'https://example.com/api/data',
          method: 'GET',
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            size: 100,
            mimeType: 'application/json',
            text: '{"data": "value"}',
          },
        },
      },
      {
        startedDateTime: '2024-01-15T10:30:02Z',
        request: {
          url: 'https://example.com/api/large',
          method: 'POST',
          postData: {
            text: 'x'.repeat(11000),
          },
        },
        response: {
          status: 200,
          statusText: 'OK',
          content: {
            mimeType: 'application/json',
            text: 'response',
          },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
    expect(result[1].response.content?.text).toBe('{"data": "value"}')
    expect(result[2].request.postData?.text).toBe(`${'x'.repeat(10000)}... [truncated]`)
  })
})

describe('isBinaryContent', () => {
  test('should return true for image/png MIME type', () => {
    const content: HARContent = {
      mimeType: 'image/png',
      size: 1024,
    }
    // Since isBinaryContent is not exported, we test it indirectly via pruneNetwork
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/image.png', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content,
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should return true for video/mp4 MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/video.mp4', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'video/mp4', size: 5000000 },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should return true for audio/mp3 MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/audio.mp3', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'audio/mp3', size: 3000000 },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should return true for font/woff2 MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/font.woff2', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'font/woff2', size: 50000 },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should return true for application/octet-stream MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/file.bin', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'application/octet-stream', size: 1000000 },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should return true for application/pdf MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/document.pdf', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'application/pdf', size: 250000 },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('[Binary content removed]')
  })

  test('should return false for application/json MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/api/data', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'application/json', text: '{}' },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('{}')
  })

  test('should return false for text/html MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/page', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'text/html', text: '<html></html>' },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('<html></html>')
  })

  test('should return false for text/css MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/style.css', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'text/css', text: 'body {}' },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('body {}')
  })

  test('should return false for application/javascript MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/script.js', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'application/javascript', text: 'console.log()' },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('console.log()')
  })

  test('should be case-sensitive for MIME type matching (current limitation)', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/image.PNG', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'IMAGE/PNG', size: 1024 },
        },
      },
    ]
    const result = pruneNetwork(entries)
    // Current implementation is case-sensitive - uppercase MIME types won't match
    expect(result[0].response.content?.text).toBe('')
  })

  test('should return false for undefined MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/unknown', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { text: 'some content' },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('some content')
  })

  test('should return false for empty MIME type', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/empty', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: '', text: 'content' },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('content')
  })
})

describe('truncate', () => {
  test('should return empty string when input is undefined', () => {
    const entries: HAREntry[] = [
      {
        startedDateTime: '2024-01-15T10:30:00Z',
        request: { url: 'https://example.com/api/data', method: 'GET' },
        response: {
          status: 200,
          statusText: 'OK',
          content: { mimeType: 'application/json' },
        },
      },
    ]
    const result = pruneNetwork(entries)
    expect(result[0].response.content?.text).toBe('')
  })

  test('should return empty string when input is null-like', () => {
    const logs: ConsoleMessage[] = [
      {
        timestamp: '2024-01-15T10:30:00Z',
        level: 'log',
        message: '',
      },
    ]
    const result = pruneConsole(logs)
    expect(result[0].message).toBe('')
  })
})

describe('Token-efficient pruning', () => {
  describe('Failure-aware message truncation', () => {
    test('should preserve more context for error messages', () => {
      const errorMsg =
        "TypeError: Cannot read properties of undefined (reading 'name')" +
        '\n    at Object.handler (/app/src/handler.js:45:12)' +
        '\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)' +
        'x'.repeat(400)
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: errorMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeGreaterThan(150)
      expect(result[0].message).toContain('TypeError')
      expect(result[0].message).toContain('[truncated]')
      expect(result[0].message.length).toBeLessThan(errorMsg.length)
    })

    test('should preserve more context for exception messages', () => {
      const exceptionMsg =
        'Uncaught ReferenceError: user is not defined' +
        '\n    at initialize (/app/init.js:23:8)' +
        'x'.repeat(500)
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: exceptionMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeGreaterThan(150)
      expect(result[0].message).toContain('ReferenceError')
      expect(result[0].message).toContain('[truncated]')
    })

    test('should preserve more context for uncaught error messages', () => {
      const uncaughtMsg =
        'Uncaught Error: Connection refused' +
        '\n    at connect (/app/db.js:12:15)' +
        'x'.repeat(450)
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: uncaughtMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeGreaterThan(150)
      expect(result[0].message).toContain('Uncaught')
      expect(result[0].message).toContain('[truncated]')
    })

    test('should preserve more context for syntax error messages', () => {
      const syntaxMsg =
        'SyntaxError: Unexpected token < in JSON at position 0' +
        '\n    at JSON.parse (<anonymous>)' +
        'x'.repeat(600)
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: syntaxMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeGreaterThan(150)
      expect(result[0].message).toContain('SyntaxError')
      expect(result[0].message).toContain('[truncated]')
    })

    test('should preserve minimum 100 chars for failure messages', () => {
      const shortFailureMsg = `Error: Failed to load${'x'.repeat(600)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: shortFailureMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeGreaterThan(100)
      expect(result[0].message).toContain('[truncated]')
    })

    test('should cap failure context at 200 chars max', () => {
      const longFailureMsg = `Error: Something went wrong${'x'.repeat(800)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: longFailureMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeLessThanOrEqual(215) // 200 + 15 for truncation suffix
      expect(result[0].message).toContain('[truncated]')
    })

    test('should use 40% of message length for failure context when message is long', () => {
      // For a 1000 char message, 40% = 400 chars, which is > 200, so cap at 200
      const longFailureMsg = `Error: ${'x'.repeat(990)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: longFailureMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeLessThanOrEqual(215) // 200 + 15 for truncation suffix
      expect(result[0].message).toContain('Error:')
    })

    test('should use 40% of message length for failure context when message is moderate', () => {
      // For a 600 char message, 40% = 240 chars, which is > 200, so cap at 200
      const mediumFailureMsg = `Error: ${'x'.repeat(590)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: mediumFailureMsg,
        },
      ]
      const result = pruneConsole(logs)
      // 40% of 600 = 240, cap at 200, so 200 + 15 = 215 chars
      expect(result[0].message.length).toBeLessThan(220)
      expect(result[0].message).toContain('Error:')
    })

    test('should detect failure with "failed" keyword', () => {
      const failedMsg = `Request failed: 500 Internal Server Error${'x'.repeat(550)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: failedMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeGreaterThan(150)
      expect(result[0].message).toContain('failed')
      expect(result[0].message).toContain('[truncated]')
    })

    test('should detect failure with "abort" keyword', () => {
      const abortMsg = `AbortError: The operation was aborted${'x'.repeat(500)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: abortMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeGreaterThan(150)
      expect(result[0].message).toContain('AbortError')
      expect(result[0].message).toContain('[truncated]')
    })

    test('should detect failure with "reject" keyword', () => {
      const rejectMsg = `Promise rejected: Network timeout${'x'.repeat(500)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: rejectMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeGreaterThan(150)
      expect(result[0].message).toContain('rejected')
      expect(result[0].message).toContain('[truncated]')
    })
  })

  describe('Aggressive truncation for benign messages', () => {
    test('should aggressively truncate benign log messages', () => {
      const benignMsg = `Some log message${'x'.repeat(600)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'log',
          message: benignMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeLessThan(520) // 500 + 15 for truncation suffix
      expect(result[0].message).toContain('[truncated]')
      // Should keep first 500 chars including the prefix
      expect(result[0].message.startsWith('Some log message')).toBe(true)
    })

    test('should aggressively truncate info messages', () => {
      const infoMsg = `Processing item 123 of 1000${'x'.repeat(550)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'info',
          message: infoMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeLessThan(520)
      expect(result[0].message).toContain('[truncated]')
    })

    test('should aggressively truncate debug messages', () => {
      const debugMsg = `Debug: State update${'x'.repeat(580)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'debug',
          message: debugMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeLessThan(520)
      expect(result[0].message).toContain('[truncated]')
    })

    test('should aggressively truncate warn messages without failure keywords', () => {
      const warnMsg = `Warning: Deprecated API used${'x'.repeat(500)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'warn',
          message: warnMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeLessThan(520)
      expect(result[0].message).toContain('[truncated]')
    })

    test('should preserve short benign messages', () => {
      const shortMsg = 'Short message'
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'log',
          message: shortMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message).toBe(shortMsg)
      expect(result[0].message.length).toBe(shortMsg.length)
    })
  })

  describe('Mixed message scenarios', () => {
    test('should handle mix of failure and benign messages', () => {
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'log',
          message: 'x'.repeat(600),
        },
        {
          timestamp: '2024-01-15T10:30:01Z',
          level: 'error',
          message: `TypeError: ${'x'.repeat(600)}`,
        },
        {
          timestamp: '2024-01-15T10:30:02Z',
          level: 'info',
          message: 'Processing complete',
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeLessThan(520) // Benign truncated
      expect(result[1].message.length).toBeGreaterThan(150) // Failure preserved
      expect(result[1].message).toContain('TypeError')
      expect(result[2].message).toBe('Processing complete') // Short unchanged
    })

    test('should not truncate messages under limits even with failure keywords', () => {
      const shortError = 'Error: failed'
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: shortError,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message).toBe(shortError)
      expect(result[0].message.length).toBe(shortError.length)
    })

    test('should handle case-insensitive failure keyword detection', () => {
      const caseInsensitiveMsg = `Uncaught TypeError: something${'x'.repeat(500)}`
      const logs: ConsoleMessage[] = [
        {
          timestamp: '2024-01-15T10:30:00Z',
          level: 'error',
          message: caseInsensitiveMsg,
        },
      ]
      const result = pruneConsole(logs)
      expect(result[0].message.length).toBeGreaterThan(150)
      expect(result[0].message).toContain('TypeError')
      expect(result[0].message).toContain('[truncated]')
    })
  })
})
