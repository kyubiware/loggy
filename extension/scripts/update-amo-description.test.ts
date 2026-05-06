import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { appendChangelog } from './update-amo-description.cjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('appendChangelog', () => {
  const existingDescription = [
    '**Loggy** is a browser DevTools extension.',
    '',
    '- Feature one',
    '- Feature two',
  ].join('\n')

  it('appends changelog with bold version heading', () => {
    const changelog = [
      '- release(extension): v1.0.8 (ea4a6ef)',
      '- feat: add preserve logs toggle (b95f672)',
    ].join('\n')

    const result = appendChangelog(existingDescription, '1.0.8', changelog)

    expect(result).toContain('**v1.0.8**')
    expect(result).toContain('- release(extension): v1.0.8 (ea4a6ef)')
    expect(result).toContain('- feat: add preserve logs toggle (b95f672)')
    // Should not use heading syntax (AMO strips h1-h6)
    expect(result).not.toMatch(/^#{1,6} v1\.0\.8$/m)
  })

  it('preserves the existing Markdown description', () => {
    const changelog = '- fix: something (abc1234)'

    const result = appendChangelog(existingDescription, '1.0.9', changelog)

    expect(result).toContain('**Loggy** is a browser DevTools extension.')
    expect(result.startsWith(existingDescription.trim())).toBe(true)
  })

  it('separates version sections with a blank line', () => {
    const changelog = '- fix: something (abc1234)'

    const result = appendChangelog(existingDescription, '1.0.9', changelog)

    // No --- separator (AMO strips <hr>)
    expect(result).not.toContain('---')
    // Should have double newline separating base from changelog
    expect(result).toMatch(/\n\n\*\*v1\.0\.9\*\*/)
  })

  it('handles empty existing description', () => {
    const changelog = '- initial release (abc1234)'

    const result = appendChangelog('', '1.0.0', changelog)

    expect(result).toContain('**v1.0.0**')
    expect(result).toContain('- initial release (abc1234)')
    // No separator when there's no existing content
    expect(result).not.toContain('---')
  })

  it('handles empty changelog gracefully', () => {
    const result = appendChangelog(existingDescription, '1.2.0', '')

    // Should still produce a version heading
    expect(result).toContain('**v1.2.0**')
  })

  it('handles single changelog entry', () => {
    const changelog = '- fix: a bug (def4567)'

    const result = appendChangelog(existingDescription, '1.0.1', changelog)

    expect(result).toContain('**v1.0.1**')
    expect(result).toContain('- fix: a bug (def4567)')
  })

  it('does not add a separator when there is no existing description', () => {
    const changelog = '- initial release (abc1234)'

    const result = appendChangelog('', '1.0.0', changelog)

    expect(result).not.toContain('---')
  })
})

describe('amo-description.md', () => {
  it('contains only AMO-compatible Markdown (no stripped HTML tags)', () => {
    const description = readFileSync(join(__dirname, 'amo-description.md'), 'utf8')

    // AMO strips these tags, so they should not appear in the description
    const strippedTags = ['<h1>', '<h2>', '<h3>', '<hr>', '<p>', '<div>', '<table>']
    for (const tag of strippedTags) {
      expect(description, `should not contain ${tag}`).not.toContain(tag)
    }

    // Should contain AMO-supported formatting
    expect(description).toContain('**')
    expect(description).toContain('`')
  })

  it('uses Markdown lists (supported by AMO: ol/ul/li are allowed tags)', () => {
    const description = readFileSync(join(__dirname, 'amo-description.md'), 'utf8')

    // Markdown list syntax IS supported — AMO renders to <ol>/<ul>/<li>
    // which are in the allowed_tags list.
    expect(description).toMatch(/^- /m) // unordered list
    expect(description).toMatch(/^\d+\.\s/m) // ordered list
  })
})
