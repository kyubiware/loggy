# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-24
**Commit:** d9311e7
**Branch:** main

## OVERVIEW
Chrome/Firefox DevTools extension capturing Console & Network logs as Markdown for LLM debugging. TypeScript + Manifest V3 + React panel UI + background service worker + popup.

## STRUCTURE
```
./
├── background/         # Service worker (see background/AGENTS.md)
│   ├── index.ts                # Entry: chrome.* listener wiring, initialization
│   ├── tab-state.ts            # Per-tab state maps + persistence (session storage)
│   ├── consent.ts              # Consent evaluation (local pages, always-log hosts, session)
│   ├── entry-storage.ts        # Capture entry storage + console/HAR conversion + token-limited purging
│   ├── server-sync.ts          # buildTabMarkdown, pushToServer, failed-export buffer
│   ├── polling.ts              # pollAndSyncTab — MAIN world array delta polling (auto-sync)
│   ├── content-scripts.ts      # Content script injection + always-log script management
│   ├── storage.ts              # Always-log host persistence (chrome.storage.local)
│   └── messages/               # Per-domain message handlers (see background/messages/AGENTS.md)
│       ├── index.ts                # handleControlMessage router + isCaptureMessage / isControlMessage type guards
│       ├── types.ts                # ControlMessageResult union (all handler return shapes)
│       ├── handle-capture.ts       # handleCaptureMessage — console/network entry ingestion
│       ├── tab-lifecycle.ts        # get-status / get-tab-status / panel-opened / panel-closed
│       ├── capture-control.ts      # toggle-debugger / start-stop / consent
│       ├── always-log.ts           # add/remove/get always-log hosts
│       ├── export-handlers.ts      # get-tab-export-data / sync-panel-data / clear
│       └── server-preview.ts       # probe-server / push-to-server / preview cache
├── capture/            # Debugger-based capture logic (Chrome-only)
│   └── debugger-capture.ts     # Chrome debugger protocol capture (no colocated tests)
├── panel/              # DevTools panel UI (React + three-context provider — see panel/AGENTS.md)
│   ├── src/                    # React components and hooks
│   │   ├── main.tsx                # React entry point
│   │   ├── App.tsx                 # Consent gate → LoggyProvider → AppContent
│   │   ├── AppContent.tsx          # Layout: PreviewPane + Toast
│   │   ├── LoggyContext.tsx        # Three-context provider (LoggyProvider)
│   │   ├── LoggyContext.types.ts   # Context value type definitions
│   │   ├── actions.ts              # Pure action handlers (clear, copy)
│   │   ├── components/             # UI components (see panel/src/components/AGENTS.md)
│   │   └── hooks/                  # React hooks (see panel/src/hooks/AGENTS.md)
│   ├── capture.ts              # Console & network capture (DevTools API)
│   ├── preview.ts              # Preview rendering (panel-specific DOM helpers)
│   └── server-probe.ts         # probeServer — server availability probe (Firefox-safe)
├── popup/              # Extension popup UI (React — see popup/AGENTS.md)
│   ├── Popup.tsx               # Root React component
│   ├── components/             # AlwaysLogHosts, FiltersAccordion, SettingsAccordion, RoutesList, etc.
│   ├── hooks/                  # usePopupActions, usePopupData, usePopupExport, usePopupSettings, isLoggingActive
│   └── constants.ts            # UI-specific constants and limits
├── fab-ui.tsx          # Firefox Android FAB root (shadow DOM mount)
├── fab/                # FAB submodules (Firefox Android — no colocated tests)
│   ├── FabContainer.tsx        # FAB container component
│   ├── useFabState.ts          # FAB state hook (capture toggle, clipboard export)
│   └── fab.css                 # FAB styles
├── preview/            # Standalone Markdown preview page (popup-launched)
│   ├── preview.tsx             # React root with rendered/raw view toggle
│   ├── preview.html            # HTML shell
│   └── index.css               # Preview styles
├── shared/             # Cross-UI components, hooks, export pipeline (see shared/AGENTS.md)
│   ├── export.ts                   # buildExportMarkdown, triggerServerExport (fire-and-forget)
│   ├── server-export.ts            # pushToServer (delegates fetch to background — Firefox CORS)
│   ├── components/                 # ConsentView, IconButtonToggle, Tooltip, OptionCheckbox
│   └── hooks/                      # useDebouncedFilter, useRouteActions, useConsentActions
├── utils/              # Pure data processing (see utils/AGENTS.md)
│   ├── filters.ts                  # Console regex + network include/exclude
│   ├── filtered-data.ts            # getFilteredPanelData helpers
│   ├── formatter.ts                # Markdown export main entry
│   ├── formatter-console.ts        # Console → Markdown
│   ├── formatter-network.ts        # HAR → Markdown (delegates to formatter-network-sections.ts)
│   ├── formatter-network-sections.ts # Network body/headers section helpers (smart-mode elision lives here)
│   ├── formatter-strings.ts        # Escape, truncate, bytes utils
│   ├── pruner.ts                   # Binary removal, body truncation
│   ├── consolidation.ts            # Console-side log grouping by signal ranking
│   ├── consolidation-network.ts    # Network-side consolidation helpers
│   ├── elevated-paths.ts           # Smart-mode elevation logic (non-2xx OR path matches console error)
│   ├── schema-sketch.ts            # sketchJsonBody — one-line schema sketch for smart-mode non-elevated
│   ├── route-patterns.ts           # normalizeRoutePattern (UUID/numeric), groupRoutesByPattern
│   ├── is-local-page.ts            # Local page detection (consent auto-allow)
│   ├── redact.ts                   # Sensitive data redaction
│   ├── token-estimate.ts           # Token count estimation
│   ├── debounce.ts                 # Generic debounce utility
│   ├── clipboard.ts                # writeClipboard — async Clipboard API + textarea fallback
│   ├── debug-logger.ts             # debugLog ring buffer (exported when __DEBUG__=true)
│   └── console-bootstrap.mjs       # MAIN world content script (patches console/fetch/XHR)
├── types/              # Shared TypeScript definitions (see types/AGENTS.md)
│   ├── console.ts          # ConsoleMessage, LogLevel
│   ├── har.ts              # HAREntry, Request, Response, Timings
│   ├── capture.ts          # CapturedConsoleEntry, CapturedNetworkEntry, CaptureMode
│   ├── control.ts          # CaptureControlMessage, ConsentState, ConsentResponseMessage
│   ├── responses.ts        # CaptureStatusMessage + response shape unions
│   ├── state.ts            # LoggyState, PersistedLoggySettings, persistence helpers
│   ├── messages.ts         # LoggyMessage union type (all extension messages)
│   └── js-modules.d.ts     # JS module global type augmentations
├── browser-apis/       # Cross-browser API abstractions (see browser-apis/AGENTS.md)
│   ├── index.ts                # Barrel export with build-time __BROWSER__ selection
│   ├── types.ts                # BrowserAPI interface
│   ├── chrome.ts               # chrome.* wrappers (event sinks MUST be lazy getters)
│   ├── firefox.ts              # browser.* wrappers (event sinks MUST be lazy getters)
│   ├── SURFACE_AUDIT.md        # Documents which API surfaces exist per browser, edge-case patterns (D10/D13/D14)
│   └── *.test.ts               # chrome.test.ts, firefox.test.ts, index.test.ts, surface-coverage.test.ts
├── scripts/            # Build/release scripts (CJS) — see scripts/AGENTS.md
├── vitest/             # Test infrastructure
│   └── mocks/base-chrome-mock.ts   # Comprehensive chrome mock factory (41+ surfaces)
├── content-relay.ts    # Content script: relays page data to background via postMessage (__LOGGY_RELAY__)
├── devtools.mjs        # DevTools entry: creates panel, injects console capture
├── manifest.json       # Manifest V3 base config
├── manifest-chrome.json  # Chrome variant (adds debugger permission + host_permissions *://*/*)
├── manifest-firefox.json # Firefox variant (adds platform_info + CSP unsafe-inline + gecko.id)
├── vite.config.ts      # Vite bundler (CRXJS HMR, TailwindCSS, React, __BROWSER__/__BUILD_KEY__/__DEBUG__ defines)
├── vitest.config.ts        # Chrome test config (jsdom, vitest.setup.ts)
├── vitest.config.firefox.ts # Firefox test config (jsdom, vitest.setup.firefox.ts)
├── vitest.setup.ts         # Chrome setup — __BROWSER__='chrome', chrome mock
├── vitest.setup.firefox.ts # Firefox setup — __BROWSER__='firefox', chrome + browser globals
├── biome.json          # Biome linting/formatting config
├── tsconfig.json       # TypeScript strict (ES2020, DOM, bundler resolution)
├── tsconfig.app.json   # Panel-app TS config (subset)
└── .husky/pre-commit   # Husky hook: biome check (NOT at repo root)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Message routing | background/index.ts | All inter-component messages via LoggyMessage |
| Capture modes | background/index.ts | debugger, content-script, devtools, inactive |
| Tab state mgmt | background/tab-state.ts | Maps of active tabs, capture state, persistence |
| Consent evaluation | background/consent.ts | local pages auto-consent, always-log hosts, active session |
| Capture entry storage | background/entry-storage.ts | readStoredEntries, writeStoredEntries, conversion helpers |
| Markdown build (background) | background/server-sync.ts | buildTabMarkdown, pushToServer, failed-export buffer |
| Background polling | background/polling.ts | pollAndSyncTab, pollAllActiveTabs — MAIN world delta polling |
| Failed export buffer | background/server-sync.ts | appendFailedExportBuffer, clearFailedExportBuffer (capped at 20) |
| Content script injection | background/content-scripts.ts | always-log script management |
| Always-log persistence | background/storage.ts | chrome.storage.local |
| Message router | background/messages/index.ts | handleControlMessage switch + type guards (see messages/AGENTS.md) |
| Per-type handlers | background/messages/*.ts | tab-lifecycle, capture-control, always-log, export-handlers, server-preview, handle-capture |
| Debugger capture | capture/debugger-capture.ts | Chrome-only, no colocated tests |
| Content script relay | content-relay.ts | postMessage → runtime.sendMessage bridge (no colocated tests) |
| Console bootstrap | utils/console-bootstrap.mjs | MAIN world: patches console/fetch/XHR (no colocated tests) |
| DevTools panel entry | devtools.mjs | Creates panel, injects console capture (no colocated tests) |
| Panel React UI | panel/src/ | Components (see panel/src/components/AGENTS.md) + hooks (see panel/src/hooks/AGENTS.md) |
| Panel business logic | panel/*.ts | capture.ts, preview.ts, server-probe.ts, actions.ts |
| Three-context provider | panel/src/LoggyContext.tsx | LogDataContext, SettingsContext, ActionsContext |
| Popup UI | popup/Popup.tsx | Status display, debugger toggle — see popup/AGENTS.md |
| Popup dual data path | popup/hooks/usePopupActions.ts | Branches on __BROWSER__ (not runtime detection) |
| FAB UI (Firefox Android) | fab-ui.tsx, fab/ | Shadow DOM, capture toggle, clipboard (no colocated tests) |
| Preview page | preview/preview.tsx | Standalone Markdown preview with rendered/raw toggle |
| Shared export pipeline | shared/export.ts | buildExportMarkdown, triggerServerExport (see shared/AGENTS.md) |
| Shared server export | shared/server-export.ts | pushToServer — delegates fetch to background (Firefox CORS) |
| Shared components | shared/components/ | ConsentView, IconButtonToggle, Tooltip, OptionCheckbox |
| Shared hooks | shared/hooks/ | useDebouncedFilter, useRouteActions, useConsentActions |
| Shared state/types | types/state.ts | LoggyState, PersistedLoggySettings, persistence helpers |
| Capture mode types | types/capture.ts | CaptureMode, CapturedConsoleEntry, CapturedNetworkEntry |
| Control message types | types/control.ts | CaptureControlMessage, ConsentState |
| Response shapes | types/responses.ts | CaptureStatusMessage + response unions |
| Filter logic | utils/filters.ts | filterConsole (regex), filterNetwork (include/exclude) |
| Filtered panel data | utils/filtered-data.ts | getFilteredPanelData helpers |
| Markdown formatting | utils/formatter.ts | Main entry, orchestrates sub-formatters |
| Network body sections | utils/formatter-network-sections.ts | Smart-mode body elision, truncateJSON (8000 char) |
| Console formatting | utils/formatter-console.ts | Console log → Markdown |
| Network formatting | utils/formatter-network.ts | HAR entry → Markdown |
| Smart-mode elevation | utils/elevated-paths.ts | Non-2xx OR URL matches console error/warn |
| Body schema sketch | utils/schema-sketch.ts | sketchJsonBody for non-elevated smart-mode |
| Route normalization | utils/route-patterns.ts | normalizeRoutePattern (UUID/numeric), groupRoutesByPattern |
| Local page detection | utils/is-local-page.ts | Auto-consent for local pages |
| Data pruning | utils/pruner.ts | Binary removal, body truncation |
| Console consolidation | utils/consolidation.ts | Signal ranking, failure grouping |
| Network consolidation | utils/consolidation-network.ts | Network-side consolidation helpers |
| Data redaction | utils/redact.ts | Sensitive data redaction |
| Token estimation | utils/token-estimate.ts | Token count for export sizing |
| Clipboard write | utils/clipboard.ts | writeClipboard — async API + textarea fallback |
| Debug logger | utils/debug-logger.ts | debugLog ring buffer (exported when __DEBUG__=true) |
| Debounce utility | utils/debounce.ts | Generic debounce helper |
| Browser APIs | browser-apis/index.ts | Cross-browser abstraction (lazy getters required — see browser-apis/AGENTS.md) |
| Build scripts | scripts/*.cjs | Release, versioning, Firefox post-processing (see scripts/AGENTS.md) |
| Test infra | vitest/mocks/base-chrome-mock.ts | Comprehensive chrome mock (41+ surfaces) |
| Extension config | manifest.json + manifest-{chrome,firefox}.json | Browser-specific manifests |
| Build config | vite.config.ts | CRXJS, Tailwind, __BROWSER__/__BUILD_KEY__/__DEBUG__ |
| Lint config | biome.json | Biome rules (noConsole allowed: error/warn/info/debug) |
| Test setup | vitest.setup.ts, vitest.setup.firefox.ts | Chrome API mocks per browser |

## KEY EXPORTS

| Symbol | Type | Location |
|--------|------|----------|
| LoggyMessage | union | types/messages.ts |
| ConsoleMessage / HAREntry | interface | types/{console,har}.ts |
| LoggyState / Persisted settings | types/state.ts | panel state persistence helpers |
| CaptureMode | type | background/index.ts |
| formatMarkdown | function | utils/formatter.ts |

## CONVENTIONS

- Strict TypeScript (noImplicitAny, strictNullChecks), ES2020 target
- 2-space indent, 100-char width, single quotes (Biome)
- Explicit import paths (../types/console), grouped: external → types → utils
- Tests colocated with source (extension/), dedicated tests/ (serve/)

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER reduce file size by compressing whitespace** — when Biome reports `noExcessiveLinesPerFunction` or `noExcessiveLinesPerFile`, split the code into smaller files or extract functions/hooks into separate modules. Do NOT put multiple statements on one line, remove blank lines between logical groups, or compact object literals to squeeze under line limits. Readability always wins.
- **NEVER mutate state directly** — use spread operator
- **NEVER use implicit any** — strict mode
- **NEVER skip error handling** — all async ops have try/catch
- **NEVER commit unfiltered data** — pruner removes binary/large payloads
- **ALWAYS debounce filter inputs** — 300ms debounce
- **NEVER use runtime browser detection** — build-time `__BROWSER__` define only
- **NEVER import browser APIs directly** outside browser-apis/
- **NEVER add browser-specific logic** outside browser-apis/ and capture/
- **ALWAYS use `debugLog()` for debugging/tracing logs** — never `console.log`. `debugLog(category, source, message, detail?)` writes to a ring buffer that's included in Markdown exports when `__DEBUG__` is true, making logs visible via the extension's own export feature. Categories: `capture`, `message`, `storage`, `lifecycle`, `perf`. Sources: `background`, `panel`, `popup`, `content`, `fab`.

## UNIQUE STYLES

- **Message passing**: background ↔ panel/popup via `chrome.runtime.sendMessage()` (LoggyMessage); content scripts via `window.postMessage('__LOGGY_RELAY__')` → content-relay.ts
- **Three capture modes**: debugger (Chrome-only, capture/debugger-capture.ts), content-script (MAIN world patches console/fetch/XHR), devtools (panel reads directly)
- **Console capture**: MAIN world content script patches page globals, stores in `window.__loggyConsoleLogs`, relayed via postMessage
- **Pruning limits**: Console 500 chars, bodies 10KB, binary types removed

## NOTES

- NOT DevTools-only — has background service worker, content scripts, AND popup
- Panel: React handles all UI; root `.ts` files are panel-specific business logic and data flow helpers
- Console capture: MAIN world content script (non-standard, patches page globals)
- Content relay: MAIN world → isolated world via `__LOGGY_RELAY__` postMessage namespace
- background/ is split: `index.ts` owns chrome.* wiring; `background/messages/` owns the per-type handler switch (see background/messages/AGENTS.md)
- Shared code lives in shared/ — see shared/AGENTS.md (ConsentView + useConsentActions + useRouteActions are the cross-UI contract)
- Popup data path branches on build-time `__BROWSER__` define in `usePopupActions.ts` (setIsFirefox) — NOT runtime detection (see project memory 222). The unified `usePopupData` hook serves both browsers; polls every 2s and re-fetches via `settingsFingerprint` of `EXPORT_RELEVANT_SETTING_KEYS` when export-relevant settings change
- Build scripts in scripts/ are CJS for Node.js compatibility (see scripts/AGENTS.md)
- Firefox builds require post-processing (manifest rewrite, content script fixup, bundle sanitization)
- Largest test files: pruner.test.ts (1317 lines), formatter.test.ts (1222 lines), useCaptureData.test.tsx (965 lines)
