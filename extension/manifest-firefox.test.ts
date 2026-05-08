import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const manifestPath = join(__dirname, 'manifest-firefox.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  permissions?: string[]
  host_permissions?: string[]
}

describe('Firefox manifest permissions', () => {
  it('requires *://*/* host access in permissions (not host_permissions) so Firefox prompts at install', () => {
    expect(manifest.permissions).toContain('*://*/*')
  })

  it('does not list *://*/* in host_permissions to avoid Firefox treating it as optional', () => {
    expect(manifest.host_permissions).not.toContain('*://*/*')
  })

  it('keeps http://localhost/* in host_permissions for companion server access', () => {
    expect(manifest.host_permissions).toContain('http://localhost/*')
  })
})
