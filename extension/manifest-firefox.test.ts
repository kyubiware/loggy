import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const manifestPath = join(__dirname, 'manifest-firefox.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  permissions?: string[]
  host_permissions?: string[]
}

describe('Firefox manifest permissions', () => {
  it('uses port wildcard in host_permissions so non-default ports like 8743 are covered', () => {
    // http://localhost/* only matches port 80 (the * is a path wildcard).
    // http://localhost:*/ matches any port (the * is a port wildcard).
    // The default loggy server runs on port 8743.
    expect(manifest.host_permissions).toContain('http://localhost:*/')
  })

  it('lists *://*/* in host_permissions for full host access (matching Chrome manifest)', () => {
    // In Firefox MV3, host patterns in permissions[] may not be recognized as
    // host permissions — they must go in host_permissions[] for fetch() to work.
    expect(manifest.host_permissions).toContain('*://*/*')
  })

  it('does not leave *://*/* only in permissions where Firefox may ignore it for host access', () => {
    expect(manifest.permissions).not.toContain('*://*/*')
  })

  it('does not include port-80-only http://localhost/* pattern', () => {
    // This pattern only covers port 80 and must not remain alongside the
    // corrected port-wildcard pattern.
    expect(manifest.host_permissions).not.toContain('http://localhost/*')
  })
})
