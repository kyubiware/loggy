# SHARED LAYER KNOWLEDGE BASE

**Scope:** Cross-UI components, hooks, and export pipeline (panel + popup + FAB)

## OVERVIEW
Architectural glue between panel, popup, and FAB UIs. Stateless React components, action-centralizing hooks, and the markdown export pipeline that converts a `LoggyState` into the final clipboard/server payload.

## STRUCTURE
```
shared/
├── export.ts                    # buildExportMarkdown(state) + triggerServerExport(state, markdown, showToast?)
├── server-export.ts             # pushToServer(url, markdown) → delegates fetch to background
├── export.test.ts               # Largest test file (~700 lines)
├── server-export.test.ts
├── components/
│   ├── ConsentView.tsx          # Consent gate UI + StopLoggingButton (panel fullPage, popup inline)
│   ├── IconButtonToggle.tsx     # Icon toggle used by panel/popup filter controls
│   ├── Tooltip.tsx              # Radix-based tooltip primitive
│   └── OptionCheckbox.tsx       # Minimal checkbox
└── hooks/
    ├── useDebouncedFilter.ts    # 300ms debounced input (refs to avoid stale closures)
    ├── useRouteActions.ts       # Route selection actions + auto-include effect
    ├── useRouteActions.test.tsx
    └── useConsentActions.ts     # start/stop/always-log message dispatch shared by panel + popup
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Build export markdown | `export.ts` `buildExportMarkdown` | Pulls active tab URL, prunes, formats, token-truncates |
| Fire-and-forget server push | `export.ts` `triggerServerExport` | Never blocks clipboard path; bails if `!serverConnected` or empty `serverUrl` |
| Server POST delegation | `server-export.ts` `pushToServer` | Sends `push-to-server` runtime message → background does fetch (avoids Firefox DevTools CORS) |
| Consent UI | `components/ConsentView.tsx` | `fullPage` prop switches panel vs popup layout |
| Route toggle/select logic | `hooks/useRouteActions.ts` | Also flips `routesFilterEnabled=true` on any user action (NOT on auto-include) |
| Start/stop logging dispatch | `hooks/useConsentActions.ts` | Single source of truth for panel + popup — prevents drift |
| Debounced text input | `hooks/useDebouncedFilter.ts` | 300ms; ref-backed to prevent stale closures |

## CONVENTIONS

- **Stateless components**: All components receive props + delegate upward. No internal state.
- **Hooks centralize message dispatch**: `useConsentActions`, `useRouteActions` exist so panel and popup cannot drift.
- **Export pipeline is pure-ish**: `buildExportMarkdown` reads `LoggyState` + `browser.tabs.query`, returns string. Side effects only via `triggerServerExport`.
- **Server push delegates to background**: never `fetch()` directly — Firefox DevTools panel origin (`moz-extension://`) hits CORS.

## ANTI-PATTERNS

- **NEVER call `fetch()` for the server from this layer** — route through `pushToServer` → background.
- **NEVER add UI state to shared components** — props in, callbacks out.
- **NEVER flip `routesFilterEnabled` from the auto-include effect** in `useRouteActions` — only explicit user actions can. Empty `selectedRoutes` means "exclude all" only when filter is enabled.
- **NEVER bypass `useConsentActions`** to send `start-logging` / `stop-logging` / `add-always-log` / `remove-always-log` from a UI — that's how panel and popup drift.

## NOTES

- `triggerServerExport` logs every call via `debugLog('message', 'panel', ...)` and bails silently when `serverConnected` is false — call sites do NOT need their own guards.
- `useRouteActions`'s auto-include effect prunes stale routes (removed from `routeOptions`) regardless of `autoIncludeRoutes`; it only adds new routes when the flag is true.
- `ConsentView` exports both `ConsentView` and `StopLoggingButton` — panel uses both, popup uses only `ConsentView` (inline).
- This directory has its own test files (`export.test.ts`, `server-export.test.ts`, `useRouteActions.test.tsx`) — keep them colocated; do not move to UI dirs.
