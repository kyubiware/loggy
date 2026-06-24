# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-22
**Commit:** 1bea433
**Branch:** main

## OVERVIEW
Chrome/Firefox DevTools extension capturing Console & Network logs as Markdown for LLM debugging. TypeScript + Manifest V3 + React panel UI + background service worker + popup.

## STRUCTURE
```
./
├── background/         # Service worker (tab state, capture modes, storage, server export)
│   ├── index.ts        # Entry: chrome.* listener wiring, initialization
│   └── messages/       # Per-domain message handlers (see background/messages/AGENTS.md)
│       ├── index.ts            # handleControlMessage router + type guards
│       ├── tab-lifecycle.ts    # status / panel-opened / panel-closed
│       ├── capture-control.ts  # toggle-debugger / start-stop / consent
│       ├── always-log.ts       # add/remove/get always-log hosts
│       ├── export-handlers.ts  # get-tab-export-data / sync-panel-data / clear
│       └── server-preview.ts   # probe-server / push-to-server / preview cache
├── capture/            # Debugger-based capture logic
│   └── debugger-capture.ts  # Chrome-only debugger protocol capture
├── panel/              # DevTools panel UI (React UI + panel-specific business logic)
│   ├── src/            # React components and hooks
│   │   ├── components/     # UI components (PreviewPane, Toast, controls/)
│   │   ├── hooks/          # React hooks (useCaptureData, useToast)
│   │   └── main.tsx        # React entry point
│   ├── capture.ts          # Console & network capture
│   ├── preview.ts          # Preview rendering (panel-specific DOM logic)
│   └── server-probe.ts     # Server availability probe used by panel UI
├── popup/              # Extension popup UI (React)
│   ├── popup.tsx        # Main popup component
│   ├── components/      # Shared + popup-specific components
│   ├── hooks/           # Popup hooks
│   └── constants.ts     # Popup constants
├── utils/              # Pure data processing
│   ├── filters.ts           # Console regex & network include/exclude filtering
│   ├── filtered-data.ts     # FilteredPanelData helpers
│   ├── debounce.ts         # Generic debounce utility
│   ├── formatter.ts         # Markdown export generation (main entry)
│   ├── formatter-console.ts # Console → Markdown table
│   ├── formatter-network.ts # HAR entry → Markdown table
│   ├── formatter-strings.ts # String escape/truncate utilities
│   ├── pruner.ts            # Binary removal, body truncation
│   ├── consolidation.ts     # Log grouping by signal ranking
│   ├── redact.ts            # Data redaction
│   ├── token-estimate.ts    # Token count estimation
│   └── console-bootstrap.mjs # MAIN world content script (patches console/fetch/XHR)
├── types/              # Shared TypeScript definitions
│   ├── console.ts      # ConsoleMessage interface, LogLevel enum
│   ├── har.ts          # HAREntry, Request, Response, Timings
│   ├── state.ts        # LoggyState, PersistedLoggySettings, persistence helpers
│   └── messages.ts     # LoggyMessage union type (all extension messages)
├── browser-apis/       # Cross-browser API abstractions
│   ├── index.ts        # Build-time selection via __BROWSER__ define
│   ├── types.ts        # BrowserAPI interface
│   ├── chrome.ts       # chrome.* API wrappers
│   └── firefox.ts      # browser.* API wrappers
├── shared/             # Cross-UI components, hooks, export pipeline (see shared/AGENTS.md)
│   ├── components/     # ConsentView, IconButtonToggle, Tooltip, OptionCheckbox
│   ├── hooks/          # useDebouncedFilter, useRouteActions, useConsentActions
│   ├── export.ts       # buildExportMarkdown, triggerServerExport (fire-and-forget)
│   └── server-export.ts # pushToServer (delegates fetch to background — Firefox CORS)
├── scripts/            # Build/release scripts (CJS) — see scripts/AGENTS.md
│   ├── release.cjs                    # Full release pipeline
│   ├── bump-version.cjs               # Version bumping (4 files)
│   ├── prepare-source-zip.cjs         # Source archive
│   ├── fix-devtools-module.cjs        # Firefox: rebundle devtools/panel as IIFE
│   ├── rewrite-firefox-manifest.cjs   # No-op stub (pipeline compat)
│   ├── sanitize-firefox-bundle.cjs    # Firefox: innerHTML → textContent
│   ├── fix-content-scripts.cjs        # Firefox: strip import/export
│   ├── update-amo-description.cjs     # AMO listing description + changelog
│   ├── upload-amo-screenshots.cjs     # AMO screenshot hash-diff upload
│   ├── screenshot-firefox.cjs         # Playwright Firefox screenshots
│   ├── screenshot-chrome.cjs          # Playwright Chromium CWS screenshots
│   ├── install-chrome.cjs             # Launch Chrome with --load-extension
│   ├── install-firefox.cjs            # RDP install / XPI profile fallback
│   ├── pack-chrome-crx.cjs            # CRX packaging (needs loggy-chrome.pem)
│   └── check-browser-apis-boundary.cjs # Lint: chrome.* only in browser-apis/
├── content-relay.ts    # Content script: relays page data to background via postMessage
├── devtools.mjs        # DevTools entry: creates panel, injects console capture
├── manifest.json       # Manifest V3 config (service_worker, content_scripts, popup)
├── vite.config.ts      # Vite bundler (CRXJS HMR, TailwindCSS, React, __BROWSER__ define)
├── biome.json          # Biome linting/formatting config
└── tsconfig.json       # TypeScript strict mode (ES2020, DOM, React JSX)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Message routing | background/index.ts | All inter-component messages via LoggyMessage |
| Capture modes | background/index.ts | debugger, content-script, devtools, inactive |
| Tab state mgmt | background/index.ts | Maps of active tabs, capture state |
| Storage | background/index.ts | chrome.storage.local for persistence |
| Server export | background/index.ts | POST to loggy-serve endpoint |
| Debugger capture | capture/debugger-capture.ts | Chrome-only, attaches via debugger protocol |
| Content script relay | content-relay.ts | postMessage → runtime.sendMessage bridge |
| Console bootstrap | utils/console-bootstrap.mjs | MAIN world: patches console/fetch/XHR |
| Panel React UI | panel/src/ | Components, hooks, main.tsx entry |
| Panel business logic | panel/*.ts | capture.ts, preview.ts, server-probe.ts |
| Shared state/types | types/state.ts | LoggyState, PersistedLoggySettings |
| Shared export helpers | shared/export.ts | buildExportMarkdown, triggerServerExport |
| Shared server export | shared/server-export.ts | pushToServer |
| Popup UI | popup/popup.tsx | Status display, debugger toggle |
| FAB UI (Firefox Android) | fab-ui.tsx, fab/ | Shadow DOM, capture toggle, clipboard |
| Preview page | preview/preview.tsx | Standalone Markdown preview with rendered/raw toggle |
| Filter logic | utils/filters.ts | Console regex, network include/exclude |
| Filtered panel data | utils/filtered-data.ts | FilteredPanelData helpers |
| Debounce utility | utils/debounce.ts | Generic debounce utility |
| Markdown formatting | utils/formatter.ts | Main entry, orchestrates sub-formatters |
| Data pruning | utils/pruner.ts | Binary removal, body truncation |
| Log consolidation | utils/consolidation.ts | Signal ranking, failure grouping |
| Token estimation | utils/token-estimate.ts | Token count for export sizing |
| Data redaction | utils/redact.ts | Sensitive data redaction |
| Type definitions | types/*.ts | ConsoleMessage, HAREntry, LoggyMessage |
| Browser APIs | browser-apis/index.ts | Cross-browser abstraction layer |
| Shared components | shared/components/ | IconButtonToggle, Tooltip |
| Build scripts | scripts/*.cjs | Release, versioning, Firefox post-processing |
| Extension config | manifest.json | Service worker, content scripts, popup |
| Build config | vite.config.ts | CRXJS, Tailwind, __BROWSER__ |
| Lint config | biome.json | Biome rules |
| Test setup | vitest.setup.ts | Chrome API mocks (mockChromeStorage, mockBootstrapInstall) |

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
- Popup data path branches on `typeof chrome.debugger === 'undefined'`: Chrome uses `usePopupData` (background message), Firefox uses `useFirefoxDirectCapture` (MAIN world read via `chrome.scripting.executeScript`, 2s poll)
- Build scripts in scripts/ are CJS for Node.js compatibility (see scripts/AGENTS.md)
- Firefox builds require post-processing (manifest rewrite, content script fixup, bundle sanitization)
- Largest test files: pruner.test.ts (1317 lines), formatter.test.ts (1222 lines), useCaptureData.test.tsx (965 lines)
