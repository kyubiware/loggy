# PANEL HOOKS KNOWLEDGE BASE

**Scope:** React hooks powering the DevTools panel

## OVERVIEW
Fifteen hooks that drive every panel concern: capture lifecycle, data + filter + route actions, persistence, server probe, auto-sync, toast. Composed by `LoggyContext.tsx` into the three-context provider pattern (LogData / Settings / Actions).

## STRUCTURE
```
hooks/
├── useCaptureData.ts          # Console/network capture state + reducer (panel DevTools API)
├── useCaptureData.test.tsx    # Largest test (~965 lines)
├── useCaptureActions.ts       # refresh / clear / copy / export-to-server action dispatchers
├── useConsentCheck.ts         # Consent state → ConsentView rendering decision
├── useDataActions.ts          # console/network data mutation actions
├── useDataCapabilities.ts     # Feature flags from settings (truncate, includeAgentContext, etc.)
├── useFilterActions.ts        # Console regex + network include/exclude setters
├── useFilteredData.ts         # Derived FilteredPanelData via getFilteredPanelData()
├── useLifecycle.ts            # Mount/unmount: preservedConsoleLogsRef, panel-opened/closed messaging
├── useLoggyActions.ts         # Centralized action dispatcher + TOGGLE_CONFIGS for data-driven UI
├── usePersistence.ts          # Persist + restore LoggyState subset to chrome.storage.local
├── useAutoSync.ts             # Auto server-sync polling loop when serverConnected
├── useServerProbe.ts          # Periodic server availability check (avoids Firefox DevTools CORS)
├── useToast.ts                # Toast state (auto-dismiss 3s)
└── useToast.ts                # (no other small helpers — keep it that way)
```

## WHERE TO LOOK

| Concern | Hook | Notes |
|---------|------|-------|
| Console/network capture state | `useCaptureData` | Reducer-based; receives DevTools API events; clears on consent change |
| Action dispatch (refresh/clear/copy/export) | `useCaptureActions` | Wraps panel `actions.ts` + shared `export.ts` |
| Consent gate | `useConsentCheck` | Polls background for current tab consent state |
| Filter setters (console regex, network patterns) | `useFilterActions` | Also toggles `routesFilterEnabled` via `useRouteActions` |
| Filtered/derived data | `useFilteredData` | Calls `getFilteredPanelData(state)` from `utils/filtered-data.ts` |
| Route selection | (shared) `useRouteActions` | Lives in `shared/hooks/`, imported by `useLoggyActions` |
| Persistence (settings → storage) | `usePersistence` | Persists `PersistedLoggySettings` keys only |
| Auto server sync | `useAutoSync` | Polls when `autoServerSync && serverConnected` |
| Server availability | `useServerProbe` | Sends `probe-server` message to background (Firefox-safe) |
| Panel lifecycle (preserve logs across reopen) | `useLifecycle` | `preservedConsoleLogsRef` is separate from background polling delta |
| Toast UI state | `useToast` | 3s auto-dismiss |
| Toggle configs (data-driven UI) | `useLoggyActions` `TOGGLE_CONFIGS` | Single source of truth for toggle button list |
| Feature flags from settings | `useDataCapabilities` | Returns `{ includeAgentContext, includeResponseBodies, ... }` |

## CONVENTIONS

- **One concern per hook** — do not add unrelated logic. Split instead.
- **Hooks compose into the three contexts**: `LogDataContext` (data), `SettingsContext` (flags), `ActionsContext` (dispatchers). Wired in `LoggyContext.tsx`.
- **Action dispatchers go through `useLoggyActions`** — that's the single entry point consumed by `useActions()`.
- **Async ops always wrapped in try/catch** (project rule).
- **Settings reads/writes go through `usePersistence`** — never touch `chrome.storage.local` directly from a hook.
- **Server communication always via background delegation** (`probe-server`, `push-to-server`) — never `fetch()` from panel.

## ANTI-PATTERNS

- **NEVER read `chrome.storage` directly** — use `usePersistence` or message the background.
- **NEVER `fetch()` from a hook** — delegate via `probe-server` / `push-to-server` messages (Firefox DevTools CORS).
- **NEVER mutate `LoggyState` directly** — use the setter from `useCaptureData` reducer or `useLoggyActions` dispatchers.
- **NEVER duplicate route toggle logic** — import `useRouteActions` from `shared/hooks/`, do not re-implement.
- **NEVER add a hook that owns long-lived state outside the reducer** — `preservedConsoleLogsRef` in `useLifecycle` is the documented exception (separate from background's `pollAndSyncTab` delta mechanism).
- **NEVER compact a hook to satisfy Biome line limits** — split into a smaller hook or extract a pure helper. See extension/AGENTS.md.

## NOTES

- `useCaptureData` reducer + `useLifecycle.preservedConsoleLogsRef` together preserve logs across panel reopenings — distinct from the background's `pollAndSyncTab` delta append.
- `useServerProbe` exists specifically because Firefox DevTools panel origin (`moz-extension://`) cannot `fetch()` arbitrary URLs without CORS errors.
- `useLoggyActions.TOGGLE_CONFIGS` is consumed by the toggle-button UI — adding a new export-relevant toggle means updating both the config array AND `EXPORT_RELEVANT_SETTING_KEYS` in `popup/hooks/usePopupData.ts` (so the popup re-fetches).
- `useCaptureData.test.tsx` is one of the largest test files in the repo (~965 lines) — extend, don't replace.
- `useCaptureData.test.tsx.patch` is a leftover patch file; do not commit changes to it as part of normal work.
