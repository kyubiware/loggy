# BACKGROUND SERVICE WORKER

## OVERVIEW
Central coordinator for tab state, capture orchestration, consent evaluation, markdown building, and server export. Manifest V3 service worker (transient, ~1300 lines).

## STRUCTURE
- `index.ts`: Entry point. Per-tab state management, message routing, consent system, failed export buffering.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Per-Tab State | `tabStates` Map, `createDefaultTabState`, `getOrCreateTabState`, `setTabState` |
| Consent System | `evaluateConsent` — checks local pages, always-log hosts, active sessions |
| Markdown Build | `buildTabMarkdown` — converts stored entries to Markdown per tab |
| Failed Export Buffer | `appendFailedExportBuffer`, `clearFailedExportBuffer` — bounded retry queue |
| Debugger Resume | `debuggerResumeTimersByTab` — deferred resume timers per tab |
| Message Router | `chrome.runtime.onMessage.addListener` — routes capture/control messages |
| Server Export | `pushToServer` — POST Markdown with handshake support |
| Persistence | `persistTabStates`, `chrome.storage.session` — survives worker restarts |

## CONVENTIONS
- Per-tab state (`TabCaptureState`) tracks mode, logCount, connected flag.
- `evaluateConsent` gates all capture: local pages auto-consent, always-log hosts use preferred mode, others require active session.
- Failed exports buffer up to 20 entries per tab in `chrome.storage.session`.
- Memory Maps must sync with `chrome.storage.session` on every state change.
- All incoming messages use `LoggyMessage` union type.

## ANTI-PATTERNS
- **NO window/DOM access**: Service worker has none. Use content scripts.
- **NO long-running listeners**: Worker sleeps. State must be resumable from storage.
- **NO direct debugger calls**: Route through `capture/debugger-capture.ts`.
- **NO unbounded buffers**: Failed export buffer capped at `MAX_FAILED_EXPORT_BUFFER` (20).

## NOTES
- `debugger` mode is Chrome-only; `content-script` works cross-browser.
- Three capture modes: debugger, content-script, devtools. Mode selection happens here.
- Tab cleanup critical to prevent memory leaks in Maps.
- Coordinates with `content-relay.ts` for bridging page events to the extension.
