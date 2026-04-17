import { describe, expect, it } from 'vitest'
import type { HAREntry } from '../types/har'
import { redactHAREntry, redactHeaders, redactString, redactUrl } from './redact'

describe('redactString', () => {
  it('redacts JWT tokens', () => {
    const jwt =
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const result = redactString(jwt)
    expect(result).not.toContain('eyJhbGci')
    expect(result).toContain('[REDACTED]')
    expect(result).toContain('Bearer')
  })

  it('redacts standalone JWT tokens without Bearer prefix', () => {
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.abc123def456'
    const result = redactString(token)
    expect(result).toBe('[REDACTED_JWT]')
  })

  it('redacts Bearer tokens', () => {
    expect(redactString('Authorization: Bearer some-opaque-token-here')).toBe(
      'Authorization: Bearer [REDACTED]'
    )
  })

  it('redacts Basic auth tokens', () => {
    expect(redactString('Authorization: Basic dXNlcjpwYXNz')).toBe(
      'Authorization: Basic [REDACTED]'
    )
  })

  it('redacts IPv4 addresses', () => {
    expect(redactString('http://192.168.1.1:3000/api')).toBe('http://[REDACTED_IP]:3000/api')
  })

  it('redacts multiple IPv4 addresses', () => {
    const result = redactString('Connecting 10.0.0.1 to 10.0.0.2')
    expect(result).toBe('Connecting [REDACTED_IP] to [REDACTED_IP]')
  })

  it('redacts email addresses', () => {
    expect(redactString('User power.seed@example.com logged in')).toBe(
      'User [REDACTED_EMAIL] logged in'
    )
  })

  it('redacts emails with subdomains', () => {
    expect(redactString('admin@mail.company.co.uk')).toBe('[REDACTED_EMAIL]')
  })

  it('redacts UUIDs', () => {
    const result = redactString('card_id: 802ed3eb-9f2c-4257-8f34-b1a7cfb02374')
    expect(result).toBe('card_id: [REDACTED_UUID]')
  })

  it('redacts multiple UUIDs', () => {
    const result = redactString(
      'id: 802ed3eb-9f2c-4257-8f34-b1a7cfb02374 parent: 03f35754-cd76-449c-96d3-eca5dd7eb538'
    )
    expect(result).toBe('id: [REDACTED_UUID] parent: [REDACTED_UUID]')
  })

  it('redacts all patterns in a single string', () => {
    const input =
      'user@test.com at 10.0.0.1 with token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123 and id 802ed3eb-9f2c-4257-8f34-b1a7cfb02374'
    const result = redactString(input)
    expect(result).not.toContain('user@test.com')
    expect(result).not.toContain('10.0.0.1')
    expect(result).not.toContain('eyJhbGci')
    expect(result).not.toContain('802ed3eb')
    expect(result).toContain('[REDACTED_EMAIL]')
    expect(result).toContain('[REDACTED_IP]')
    expect(result).toContain('[REDACTED_JWT]')
    expect(result).toContain('[REDACTED_UUID]')
  })

  it('returns unchanged string when nothing matches', () => {
    expect(redactString('Hello world')).toBe('Hello world')
  })

  it('handles empty string', () => {
    expect(redactString('')).toBe('')
  })

  it('applies Bearer redaction before JWT to avoid double-redaction', () => {
    const jwt = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123def456'
    const result = redactString(jwt)
    // Bearer pattern catches "Bearer <token>" first
    expect(result).toBe('Bearer [REDACTED]')
  })
})

describe('redactHeaders', () => {
  it('redacts sensitive header values while preserving names', () => {
    const headers = [
      { name: 'Authorization', value: 'Bearer some-token-123' },
      { name: 'Content-Type', value: 'application/json' },
      { name: 'Host', value: '192.168.1.1:4001' },
    ]
    const result = redactHeaders(headers)

    expect(result[0]).toEqual({ name: 'Authorization', value: 'Bearer [REDACTED]' })
    expect(result[1]).toEqual({ name: 'Content-Type', value: 'application/json' })
    expect(result[2]).toEqual({ name: 'Host', value: '[REDACTED_IP]:4001' })
  })

  it('returns empty array for empty input', () => {
    expect(redactHeaders([])).toEqual([])
  })

  it('does not mutate original headers', () => {
    const original = [{ name: 'Authorization', value: 'Bearer secret' }]
    const result = redactHeaders(original)
    expect(original[0].value).toBe('Bearer secret')
    expect(result[0].value).toBe('Bearer [REDACTED]')
  })
})

describe('redactUrl', () => {
  it('redacts IP addresses in URLs', () => {
    expect(redactUrl('http://100.99.151.71:3001/api/data')).toBe(
      'http://[REDACTED_IP]:3001/api/data'
    )
  })

  it('preserves domain names', () => {
    expect(redactUrl('https://api.example.com/data')).toBe('https://api.example.com/data')
  })

  it('handles URLs without IPs', () => {
    expect(redactUrl('https://localhost:3000/api')).toBe('https://localhost:3000/api')
  })
})

describe('redactHAREntry', () => {
  it('redacts URL, headers, and bodies in a full HAR entry', () => {
    const entry: HAREntry = {
      startedDateTime: '2026-04-03T22:33:09.552Z',
      request: {
        url: 'http://100.99.151.71:4001/api/cards/list',
        method: 'GET',
        headers: [
          {
            name: 'Authorization',
            value: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123',
          },
          { name: 'Host', value: '100.99.151.71:4001' },
        ],
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        content: {
          size: 1463,
          mimeType: 'application/json',
          text: '{"email":"user@test.com","id":"802ed3eb-9f2c-4257-8f34-b1a7cfb02374"}',
        },
      },
      time: 31.77,
    }

    const result = redactHAREntry(entry)

    // URL should have IP redacted
    expect(result.request.url).toBe('http://[REDACTED_IP]:4001/api/cards/list')

    // Request headers should be redacted
    expect(result.request.headers?.[0]?.value).toBe('Bearer [REDACTED]')
    expect(result.request.headers?.[1]?.value).toBe('[REDACTED_IP]:4001')

    // Response headers should be preserved when no sensitive data
    expect(result.response.headers?.[0]?.value).toBe('application/json')

    // Response body should have email and UUID redacted
    expect(result.response.content?.text).not.toContain('user@test.com')
    expect(result.response.content?.text).not.toContain('802ed3eb')
    expect(result.response.content?.text).toContain('[REDACTED_EMAIL]')
    expect(result.response.content?.text).toContain('[REDACTED_UUID]')

    // Non-sensitive fields preserved
    expect(result.response.status).toBe(200)
    expect(result.response.statusText).toBe('OK')
    expect(result.startedDateTime).toBe('2026-04-03T22:33:09.552Z')
    expect(result.time).toBe(31.77)
  })

  it('redacts request body with sensitive data', () => {
    const entry: HAREntry = {
      startedDateTime: '2026-04-03T22:33:40.231Z',
      request: {
        url: 'http://10.0.0.1:4001/api/srs/schedule',
        method: 'POST',
        headers: [],
        postData: {
          mimeType: 'application/json',
          text: '{"card_id":"802ed3eb-9f2c-4257-8f34-b1a7cfb02374","rating":2}',
        },
      },
      response: {
        status: 200,
        statusText: 'OK',
        headers: [],
      },
      time: 6.05,
    }

    const result = redactHAREntry(entry)

    expect(result.request.url).toBe('http://[REDACTED_IP]:4001/api/srs/schedule')
    expect(result.request.postData?.text).toBe('{"card_id":"[REDACTED_UUID]","rating":2}')
  })

  it('handles entry with no headers or bodies', () => {
    const entry: HAREntry = {
      startedDateTime: '2026-04-03T22:33:09Z',
      request: {
        url: 'https://api.example.com/health',
        method: 'GET',
      },
      response: {
        status: 200,
        statusText: 'OK',
      },
    }

    const result = redactHAREntry(entry)

    expect(result.request.url).toBe('https://api.example.com/health')
    expect(result.response.status).toBe(200)
  })

  it('does not mutate the original entry', () => {
    const entry: HAREntry = {
      startedDateTime: '2026-04-03T22:33:09Z',
      request: {
        url: 'http://10.0.0.1/api',
        method: 'GET',
        headers: [{ name: 'Authorization', value: 'Bearer secret-token' }],
      },
      response: { status: 200, statusText: 'OK' },
    }

    redactHAREntry(entry)

    expect(entry.request.url).toBe('http://10.0.0.1/api')
    expect(entry.request.headers?.[0]?.value).toBe('Bearer secret-token')
  })
})
