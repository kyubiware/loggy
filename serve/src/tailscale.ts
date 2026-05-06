import { execSync } from 'node:child_process'

export interface TailscaleCertInfo {
  hostname: string
  cert: Buffer
  key: Buffer
}

export interface TailscaleDetectResult {
  /** Certs were successfully provisioned. */
  certs: TailscaleCertInfo | null
  /**
   * Tailscale is running and has cert domains, but cert generation failed.
   * Contains the domain detected and the error message from `tailscale cert`.
   */
  certError?: {
    domain: string
    hostname: string
    message: string
  }
}

interface TailscaleStatus {
  BackendState: string
  CertDomains?: string[]
  Self?: {
    DNSName?: string
  }
}

/**
 * Detect Tailscale status and attempt to provision certs.
 * Returns a rich result so callers can distinguish "not installed/running"
 * from "detected but cert generation failed".
 */
export function detectTailscale(): TailscaleDetectResult {
  let status: TailscaleStatus

  try {
    const statusOutput = execSync('tailscale status --json', {
      timeout: 5000,
      encoding: 'utf8',
    })
    status = JSON.parse(statusOutput)
  } catch {
    return { certs: null }
  }

  if (status.BackendState !== 'Running') {
    return { certs: null }
  }

  if (!status.CertDomains || status.CertDomains.length === 0) {
    return { certs: null }
  }

  const rawHostname = status.Self?.DNSName
  if (!rawHostname) {
    return { certs: null }
  }

  const hostname = rawHostname.endsWith('.')
    ? rawHostname.slice(0, -1)
    : rawHostname

  const domain = status.CertDomains[0]

  try {
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
      return { certs: null }
    }

    return {
      certs: {
        hostname,
        cert: Buffer.from(certBlocks.join('\n')),
        key: Buffer.from(keyMatch[0]),
      },
    }
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message.split('\n')[0]
        : String(error)

    return {
      certs: null,
      certError: { domain, hostname, message },
    }
  }
}

/**
 * Convenience wrapper that returns certs only (null if unavailable).
 * Preserves backward compatibility for callers that don't need detection details.
 */
export function getTailscaleCerts(): TailscaleCertInfo | null {
  return detectTailscale().certs
}
