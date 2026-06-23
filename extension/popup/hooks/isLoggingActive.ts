import type { StatusResponse } from '../../types/messages'

/**
 * Derives whether the popup should reflect an "actively capturing" state
 * (Pause icon) vs an "inactive" state (Play icon / consent view).
 *
 * Semantics:
 * - `devtools` → active (the DevTools panel is open and capturing directly;
 *   the popup can't toggle this off, but it should still reflect that
 *   capture is happening).
 * - `debugger` → active (Chrome debugger attached via toggle-debugger).
 * - `content-script` on Firefox → active (Firefox lacks the debugger API,
 *   so content-script IS the primary capture mode after Start Logging).
 * - `content-script` on Chrome → INACTIVE (paused — `toggle-debugger`
 *   detached the debugger and fell back to content-script per the
 *   `handleToggleDebugger` fallback in `capture-control.ts`; user must
 *   click Play to re-attach).
 * - `inactive` → inactive (consent view / stopped).
 * - `null`/`undefined` status → inactive (initial load, no tab).
 */
export function computeIsLoggingActive(
  status: StatusResponse | null | undefined,
  isFirefox: boolean,
): boolean {
  return (
    status?.mode === 'devtools' ||
    status?.mode === 'debugger' ||
    (isFirefox && status?.mode === 'content-script')
  )
}
