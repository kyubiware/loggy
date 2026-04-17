/**
 * Console log type definitions for Loggy Chrome Extension
 * Interfaces for capturing and filtering console messages
 */

/**
 * Console log level types
 */
export type ConsoleLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'

/**
 * Single console log entry captured from the inspected window
 */
export interface ConsoleMessage {
  /** ISO 8601 timestamp of the log */
  timestamp: string
  /** Log level (log, warn, error, info, debug) */
  level: ConsoleLevel
  /** Log message (may include multiple arguments serialized) */
  message: string
}

/**
 * Result from inspected window eval during console capture
 */
export interface ConsoleCaptureResult {
  /** Array of captured console messages */
  __loggyConsoleLogs?: ConsoleMessage[]
}

/**
 * Console capture script result type for TypeScript typing
 */
export type EvalResult = ConsoleCaptureResult | ConsoleMessage[] | null | undefined
