# BACKGROUND MESSAGE HANDLERS KNOWLEDGE BASE

**Scope:** Message router + per-domain handlers (split out of `background/index.ts`)

## OVERVIEW
Single entry point `handleControlMessage` dispatches every `CaptureControlMessage` type to a focused handler. Captures the entire background ↔ panel/popup contract in one place.

## STRUCTURE
```
messages/
├── index.ts              # handleControlMessage router + isCaptureMessage / isControlMessage type guards
├── types.ts              # ControlMessageResult union (all possible handler return shapes)
├── handle-capture.ts     # handleCaptureMessage — console/network entry ingestion
├── tab-lifecycle.ts      # get-status, get-tab-status, panel-opened, panel-closed
├── capture-control.ts    # toggle-debugger, content-relay-ready, start/stop-logging, request-consent, consent-response
├── always-log.ts         # add/remove/get always-log hosts
├── export-handlers.ts    # get-tab-export-data, clear-tab-data, sync-panel-data (panel → storage)
├── export-handlers.test.ts
└── server-preview.ts     # probe-server, push-to-server, cache-preview, get-cached-preview
```

## WHERE TO LOOK

| Message `type` | Handler | Returns |
|----------------|---------|---------|
| `get-status` | `tab-lifecycle.ts` `handleGetStatus` | `StatusResponse` |
| `get-tab-status` | `tab-lifecycle.ts` `handleGetTabStatus` | `TabCaptureState` |
| `panel-opened` / `panel-closed` | `tab-lifecycle.ts` | `{ ok: boolean }` |
| `toggle-debugger` | `capture-control.ts` `handleToggleDebugger` | `TabCaptureState` |
| `content-relay-ready` | `capture-control.ts` `handleContentRelayReady` | `TabCaptureState` |
| `start-logging` / `stop-logging` | `capture-control.ts` | `{ ok }` |
| `request-consent` / `consent-response` | `capture-control.ts` | `ConsentState` / `ConsentResponseMessage` |
| `add-always-log` / `remove-always-log` / `get-always-log-hosts` | `always-log.ts` | `AlwaysLogHostsResponse` or `{ ok }` |
| `get-tab-export-data` | `export-handlers.ts` `handleGetTabExportData` | `TabExportDataResponse` |
| `clear-tab-data` | `export-handlers.ts` `handleClearTabData` | `{ ok }` |
| `sync-panel-data` | `export-handlers.ts` `handleSyncPanelData` | `{ ok }` (DevTools panel → storage full replace) |
| `probe-server` | `server-preview.ts` `handleProbeServer` | `ProbeServerResponse` |
| `push-to-server` | `server-preview.ts` `handlePushToServer` | `PushToServerResponse` |
| `cache-preview` / `get-cached-preview` | `server-preview.ts` | `CachePreviewResponse` / `CachedPreviewResponse` |
| (capture, no `type`) | `handle-capture.ts` `handleCaptureMessage` | ingests console/network source entries |

## CONVENTIONS

- **One file per concern**: lifecycle, capture-control, always-log, export-handlers, server-preview. Do not mix.
- **Router stays dumb**: `index.ts` `handleControlMessage` is a `switch (message.type)` — no business logic.
- **All return shapes flow through `ControlMessageResult`** (types.ts) — extend the union when adding a new message type.
- **Type guards `isCaptureMessage` / `isControlMessage`** are the source of truth for runtime message routing in `background/index.ts`.
- **Handlers may be async** — router awaits them. Long-running work is fine but should not block the worker event loop (no sync I/O).

## ANTI-PATTERNS

- **NEVER add business logic to `index.ts`** — extract to a handler file.
- **NEVER import handler internals from outside this directory** — callers go through `handleControlMessage` or the re-exported `handleCaptureMessage`.
- **NEVER extend the type-guard lists inconsistently** — when adding a new message type, update BOTH the `CaptureControlMessage` union in `types/messages.ts` AND the `isControlMessage` check in `index.ts`.
- **NEVER add a handler that calls another handler directly** — route through the message router or refactor the shared logic into `tab-state.ts` / `entry-storage.ts` / `server-sync.ts`.

## NOTES

- `handleGetTabExportData` reads all settings fresh from `chrome.storage.local` on every call — that's why adding export-relevant settings needs no message-type change (see memory: `EXPORT_RELEVANT_SETTING_KEYS` is the popup-side companion).
- `handleSyncPanelData` is gated by `panelDataFingerprint()` upstream to avoid redundant storage writes — DevTools mode only.
- `handlePushToServer` performs the actual `fetch()` (the only place server fetch happens) — panel/popup/shared code delegates via `push-to-server` message.
- Tests in `export-handlers.test.ts` mock the storage layer, not the handler signatures.
