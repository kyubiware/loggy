# BACKGROUND SERVICE WORKER

## OVERVIEW
Central coordinator for tab state, capture orchestration, consent evaluation, markdown building, and server export. Manifest V3 service worker split across focused modules.

## STRUCTURE
- `index.ts`: Entry point. Initialization, chrome.* event listener wiring (~431 lines).
- `messages/`: Per-domain message handlers split out by concern. **See `messages/AGENTS.md`.**
  - `index.ts` — `handleControlMessage` router + `isCaptureMessage` / `isControlMessage` type guards
  - `types.ts` — `ControlMessageResult` union (all handler return shapes)
  - `handle-capture.ts` — `handleCaptureMessage` ingests raw console/network entries (no `type` field)
  - `tab-lifecycle.ts`, `capture-control.ts`, `always-log.ts`, `export-handlers.ts`, `server-preview.ts`
- `tab-state.ts`: Per-tab state management. Maps, CRUD, persistence, icon updates, `debuggerResumeTimersByTab`.
- `consent.ts`: Consent evaluation (local pages, always-log hosts, per-session).
- `entry-storage.ts`: Capture entry storage, conversion (console/HAR), token-limited purging.
- `server-sync.ts`: Server communication, export pipeline, failed export buffer, settings helpers.
- `polling.ts`: Background auto-sync polling (MAIN world array polling, fingerprinting).
- `content-scripts.ts`: Content script injection and always-log script management.
- `storage.ts`: Always-log host persistence (chrome.storage.local).
- Tests (colocated, no separate dir): `always-log-get-status.test.ts`, `auto-sync.test.ts` (largest, ~774 lines), `clear-tab-data.test.ts`, `content-scripts.test.ts`, `panel-lifecycle.test.ts`, `stop-logging.test.ts` (~481 lines). No colocated tests in `messages/` except `export-handlers.test.ts`.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Per-Tab State | `tab-state.ts` — `tabStates` Map, `createDefaultTabState`, `getOrCreateTabState`, `setTabState` |
| Consent System | `consent.ts` — `evaluateConsent` checks local pages, always-log hosts, active sessions |
| Entry Storage | `entry-storage.ts` — `readStoredEntries`, `writeStoredEntries`, `storeCapturedData`, conversion helpers |
| Markdown Build | `server-sync.ts` — `buildTabMarkdown` converts stored entries to Markdown per tab |
| Failed Export Buffer | `server-sync.ts` — `appendFailedExportBuffer`, `clearFailedExportBuffer` — bounded retry queue |
| Debugger Resume | `tab-state.ts` — `debuggerResumeTimersByTab` — deferred resume timers per tab |
| Message Router | `messages/index.ts` — `handleControlMessage`, `handleCaptureMessage`, type guards (see `messages/AGENTS.md`) |
| Per-type handlers | `messages/{tab-lifecycle,capture-control,always-log,export-handlers,server-preview}.ts` |
| Server Export | `server-sync.ts` — `pushToServer`, `exportTabToServer`, `probeServerFromBackground` |
| Background Polling | `polling.ts` — `pollAndSyncTab`, `pollAllActiveTabs` — auto-sync via MAIN world scripts |
| Persistence | `tab-state.ts` — `persistTabStates`, `restoreTabStatesFromStorage` — survives worker restarts |
| Initialization | `index.ts` — `initialize()`, chrome.* listener registration |

## DEPENDENCY GRAPH
```
tab-state → (none)
consent → tab-state, storage
entry-storage → tab-state
server-sync → tab-state, entry-storage
polling → tab-state, entry-storage, server-sync
messages → tab-state, consent, entry-storage, server-sync, polling
index → all of the above + content-scripts, storage, debugger-capture
```

`messages/` itself is internally layered: `index.ts` (router) → per-domain handlers (`tab-lifecycle`, `capture-control`, `always-log`, `export-handlers`, `server-preview`, `handle-capture`) → background core (`tab-state`, `entry-storage`, `server-sync`).

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
- **NO circular imports**: Dependency graph is a strict DAG (see above).

## NOTES
- `debugger` mode is Chrome-only; `content-script` works cross-browser.
- Three capture modes: debugger, content-script, devtools. Mode selection happens in `consent.ts` and `messages.ts`.
- Tab cleanup critical to prevent memory leaks in Maps.
- Coordinates with `content-relay.ts` for bridging page events to the extension.
- Tests import `./index` which triggers side-effect listener registration — mock paths (`./content-scripts`, `./storage`, `../capture/debugger-capture`, `../shared/export`) must not change.
