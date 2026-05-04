import { execSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface TailscaleCertInfo {
  hostname: string
  cert: Buffer
  key: Buffer
}

interface TailscaleStatus {
  BackendState: string
  CertDomains?: string[]
  Self?: {
    DNSName?: string
  }
}

export function getTailscaleCerts(): TailscaleCertInfo | null {
  try {
    const statusOutput = execSync('tailscale status --json', {
      timeout: 5000,
      encoding: 'utf8',
    })

    const status: TailscaleStatus = JSON.parse(statusOutput)

    if (status.BackendState !== 'Running') {
      return null
    }

    if (!status.CertDomains || status.CertDomains.length === 0) {
      return null
    }

    const rawHostname = status.Self?.DNSName
    if (!rawHostname) {
      return null
    }

    const hostname = rawHostname.endsWith('.')
      ? rawHostname.slice(0, -1)
      : rawHostname

    const domain = status.CertDomains[0]

    // Use stdout mode to avoid snap filesystem confinement issues.
    // Output contains: leaf cert + intermediate cert + private key.
    const combined = execSync(
      `tailscale cert --cert-file=- --key-file=- "${domain}"`,
      { timeout: 15000 },
    )

    const pem = combined.toString('utf8')

    // Extract certificate chain (all CERTIFICATE blocks)
    const certBlocks: string[] = []
    const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g
    let match = certRegex.exec(pem)
    while (match) {
      certBlocks.push(match[0])
      match = certRegex.exec(pem)
    }

    // Extract private key
    const keyMatch = pem.match(/-----BEGIN (?:EC )?PRIVATE KEY-----[\s\S]*?-----END (?:EC )?PRIVATE KEY-----/)
    if (certBlocks.length === 0 || !keyMatch) {
      return null
    }

    return {
      hostname,
      cert: Buffer.from(certBlocks.join('\n')),
      key: Buffer.from(keyMatch[0]),
    }
  } catch {
    return null
  }
}
