/**
 * HAR (HTTP Archive) type definitions for Loggy Chrome Extension
 * Minimal subset of HAR 1.2 specification needed for network capture
 */

/**
 * Header name/value pair
 */
export interface HARHeader {
  name: string
  value: string
}

/**
 * Request details
 */
export interface HARRequest {
  /** Request URL */
  url: string
  /** HTTP method (GET, POST, etc.) */
  method: string
  /** Request headers */
  headers?: HARHeader[]
  /** Post data for POST/PUT requests */
  postData?: {
    mimeType?: string
    text?: string
  }
}

/**
 * Response content details
 */
export interface HARContent {
  /** Content size in bytes */
  size?: number
  /** MIME type */
  mimeType?: string
  /** Text content (for text-based responses) */
  text?: string
}

/**
 * Response details
 */
export interface HARResponse {
  /** HTTP status code */
  status: number
  /** HTTP status text (e.g., "OK", "Not Found") */
  statusText: string
  /** Response headers */
  headers?: HARHeader[]
  /** Response content */
  content?: HARContent
}

/**
 * Individual HTTP request/response entry
 */
export interface HAREntry {
  /** Timestamp of request start */
  startedDateTime: string
  /** Request details */
  request: HARRequest
  /** Response details */
  response: HARResponse
  /** Total request time in milliseconds */
  time?: number
  /**
   * Chrome-specific resource type category (e.g., "XHR", "Fetch", "Document", "Script").
   * Absent in non-Chrome browsers or when type cannot be determined.
   */
  _resourceType?: string
}

/**
 * Root HAR log object
 */
export interface HARLog {
  /** Array of HTTP request/response entries */
  entries?: HAREntry[]
}
