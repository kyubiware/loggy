import type { HAREntry, HARHeader } from '../types/har'

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g
const AUTH_TOKEN_PATTERN = /(Bearer|Basic)\s+\S+/gi
const IPV4_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/**
 * Redacts sensitive patterns from arbitrary text.
 * @param text - Input text to redact
 * @returns Redacted text with sensitive values replaced
 */
export function redactString(text: string): string {
  return text
    .replace(AUTH_TOKEN_PATTERN, '$1 [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED_JWT]')
    .replace(IPV4_PATTERN, '[REDACTED_IP]')
    .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
    .replace(UUID_PATTERN, '[REDACTED_UUID]')
}

/**
 * Redacts sensitive values from HTTP headers while preserving header names.
 * @param headers - Header name/value pairs to redact
 * @returns New array with redacted header values
 */
export function redactHeaders(headers: HARHeader[]): HARHeader[] {
  return headers.map((header) => ({
    ...header,
    value: redactString(header.value),
  }))
}

/**
 * Redacts sensitive information in URL strings.
 * @param url - URL string to redact
 * @returns URL with sensitive segments redacted
 */
export function redactUrl(url: string): string {
  return url.replace(IPV4_PATTERN, '[REDACTED_IP]')
}

/**
 * Deep redacts sensitive information from a HAR entry.
 * @param entry - HAR entry to redact
 * @returns New HAR entry with redacted URL, headers, and text bodies
 */
export function redactHAREntry(entry: HAREntry): HAREntry {
  return {
    ...entry,
    request: {
      ...entry.request,
      url: redactUrl(entry.request.url),
      headers: entry.request.headers ? redactHeaders(entry.request.headers) : entry.request.headers,
      postData: entry.request.postData
        ? {
            ...entry.request.postData,
            text: entry.request.postData.text
              ? redactString(entry.request.postData.text)
              : entry.request.postData.text,
          }
        : entry.request.postData,
    },
    response: {
      ...entry.response,
      headers: entry.response.headers
        ? redactHeaders(entry.response.headers)
        : entry.response.headers,
      content: entry.response.content
        ? {
            ...entry.response.content,
            text: entry.response.content.text
              ? redactString(entry.response.content.text)
              : entry.response.content.text,
          }
        : entry.response.content,
    },
  }
}
