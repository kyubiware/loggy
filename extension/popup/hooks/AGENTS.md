# POPUP HOOKS KNOWLEDGE BASE

**Scope:** React hooks powering the popup surface (7 files, 1035 LOC)

## OVERVIEW
Popup business logic. Dual data path branches on build-time `__BROWSER__` define (NOT runtime detection — see project memory 222). Chrome path messages the background; Firefox path reads MAIN world arrays directly via `chrome.scripting.executeScript`. Unified `usePopupData` hook serves both browsers with a 2s polling cadence and `settingsFingerprint`-driven re-fetch.

## STRUCTURE
```
hooks/
├── usePopupActions.ts        # Action dispatch; branches on __BROWSER__; setIsFirefox
├── usePopupData.ts           # Status polling + settingsFingerprint re-fetch (2s cadence)
├── usePopupExport.ts         # Export actions (clipboard, server push)
├── usePopupSettings.ts       # Settings state management
├── isLoggingActive.ts        # Logging active predicate
├── isLoggingActive.test.ts
└── usePopupData.test.ts      # (~339 lines)
```

## WHERE TO LOOK

| Concern | Hook | Notes |
|---------|------|-------|
| Browser branching (Chrome vs Firefox) | `usePopupActions.ts` | `setIsFirefox = __BROWSER__ === 'firefox'` (build-time) |
| Status polling | `usePopupData.ts` | Sends `get-tab-export-data` every `POLL_INTERVAL_MS` (2000ms) |
| Re-fetch trigger | `usePopupData.ts` | `settingsFingerprint` of `EXPORT_RELEVANT_SETTING_KEYS` (JSON.stringify of values) |
| Export actions | `usePopupExport.ts` | Copy to clipboard, push to server (via background delegation) |
| Settings state | `usePopupSettings.ts` | Read/write PersistedLoggySettings |
| Logging predicate | `isLoggingActive.ts` | Boolean from capture state |

## CONVENTIONS

- **One concern per hook** — split instead of growing.
- **Settings reads/writes always through background delegation** — popup never touches `chrome.storage.local` directly.
- **Server communication always via background messages** (`probe-server`, `push-to-server`) — never `fetch()` from popup (Firefox DevTools CORS).
- **Async ops always wrapped in try/catch** (project rule).
- **Adding a new persisted setting that affects Markdown export**: add its key to `EXPORT_RELEVANT_SETTING_KEYS` in `usePopupData.ts` so the Chrome path re-fetches when it changes.

## ANTI-PATTERNS

- **NEVER use runtime browser detection** (`typeof chrome.debugger`, navigator checks) — use build-time `__BROWSER__` define (see project memory 222).
- **NEVER read `chrome.storage` directly** — message the background via `get-tab-export-data`.
- **NEVER `fetch()` from a hook** — delegate via `probe-server` / `push-to-server` messages.
- **NEVER mutate `LoggyState` directly** — use the setter from `usePopupSettings`.
- **NEVER duplicate route toggle logic** — import `useRouteActions` from `shared/hooks/`.
- **NEVER bypass `useConsentActions`** to send `start-logging` / `stop-logging` / `add-always-log` / `remove-always-log` from a popup component.

## NOTES

- `EXPORT_RELEVANT_SETTING_KEYS` deliberately EXCLUDES pure-UI or undebounced keys: `serverUrl`, `settingsAccordionOpen`, `filtersAccordionOpen`, `networkExportEnabled`, `autoServerSync`, `autoIncludeRoutes`, `preserveLogs`. Adding a setting here without considering that exclusion causes redundant re-fetches.
- Background `handleGetTabExportData` reads all settings fresh from `chrome.storage.local` on every call — that's why adding export-relevant settings needs no message-type change.
- Both browser paths converge on `getFilteredPanelData()` (from `utils/filtered-data.ts`) for the final filtered view.
- The 2s poll is the ONLY data refresh mechanism for the popup — there is no push from background to popup.
