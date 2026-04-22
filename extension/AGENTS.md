# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-22
**Commit:** 6263307
**Branch:** main

## OVERVIEW
Chrome/Firefox DevTools extension capturing Console & Network logs as Markdown for LLM debugging. TypeScript + Manifest V3 + React panel UI + background service worker + popup.

## STRUCTURE
```
./
├── background/         # Service worker (tab state, capture modes, storage, server export)
│   └── index.ts        # 738 lines - message routing, capture coordination, chrome.storage
├── capture/            # Debugger-based capture logic
│   └── debugger-capture.ts  # Chrome-only debugger protocol capture
├── panel/              # DevTools panel UI (React + vanilla JS dual architecture)
│   ├── src/            # React components and hooks
│   │   ├── components/     # UI components (PreviewPane, Toast, controls/)
│   │   ├── hooks/          # React hooks (useCaptureData, useToast)
│   │   └── main.tsx        # React entry point
│   ├── state.ts            # LoggyState interface
│   ├── capture.ts          # Console & network capture
│   ├── export.ts           # Markdown + server export
│   ├── preview.ts          # Preview rendering (non-React)
│   └── toast.ts            # Toast notification (non-React)
├── popup/              # Extension popup UI (React)
│   ├── popup.tsx        # Main popup component
│   ├── components/      # Shared + popup-specific components
│   ├── hooks/           # Popup hooks
│   └── constants.ts     # Popup constants
├── utils/              # Pure data processing
│   ├── filters.ts           # Console regex & network include/exclude filtering
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
│   └── messages.ts     # LoggyMessage union type (all extension messages)
├── browser-apis/       # Cross-browser API abstractions
│   ├── index.ts        # Build-time selection via __BROWSER__ define
│   ├── types.ts        # BrowserAPI interface
│   ├── chrome.ts       # chrome.* API wrappers
│   └── firefox.ts      # browser.* API wrappers
├── shared/             # Shared React components
│   └── components/     # IconButtonToggle, Tooltip (used by panel/ and popup/)
├── scripts/            # Build/release scripts (CJS)
│   ├── release.cjs           # Full release pipeline
│   ├── bump-version.cjs      # Version bumping
│   ├── prepare-source-zip.cjs # Source archive
│   ├── fix-content-scripts.cjs # Post-build content script fixup
│   ├── rewrite-firefox-manifest.cjs # Firefox manifest rewrite
│   └── sanitize-firefox-bundle.cjs # Firefox bundle sanitization
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
| Panel vanilla JS | panel/*.ts | capture.ts, export.ts, preview.ts, toast.ts |
| Popup UI | popup/popup.tsx | Status display, debugger toggle |
| Filter logic | utils/filters.ts | Console regex, network include/exclude |
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
| CaptureMode | type | background/index.ts |
| formatMarkdown | function | utils/formatter.ts |

## CONVENTIONS

- Strict TypeScript (noImplicitAny, strictNullChecks), ES2020 target
- 2-space indent, 100-char width, single quotes (Biome)
- Explicit import paths (../types/console), grouped: external → types → utils
- Tests colocated with source (extension/), dedicated tests/ (serve/)

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER mutate state directly** — use spread operator
- **NEVER use implicit any** — strict mode
- **NEVER skip error handling** — all async ops have try/catch
- **NEVER commit unfiltered data** — pruner removes binary/large payloads
- **ALWAYS debounce filter inputs** — 300ms debounce
- **NEVER use runtime browser detection** — build-time `__BROWSER__` define only
- **NEVER import browser APIs directly** outside browser-apis/
- **NEVER add browser-specific logic** outside browser-apis/ and capture/

## UNIQUE STYLES

- **Message passing**: background ↔ panel/popup via `chrome.runtime.sendMessage()` (LoggyMessage); content scripts via `window.postMessage('__LOGGY_RELAY__')` → content-relay.ts
- **Three capture modes**: debugger (Chrome-only, capture/debugger-capture.ts), content-script (MAIN world patches console/fetch/XHR), devtools (panel reads directly)
- **Console capture**: MAIN world content script patches page globals, stores in `window.__loggyConsoleLogs`, relayed via postMessage
- **Pruning limits**: Console 500 chars, bodies 10KB, binary types removed

## NOTES

- NOT DevTools-only — has background service worker, content scripts, AND popup
- Panel: dual architecture (React src/ + vanilla JS root files)
- Console capture: MAIN world content script (non-standard, patches page globals)
- Content relay: MAIN world → isolated world via `__LOGGY_RELAY__` postMessage namespace
- background/index.ts (738 lines) — central coordinator: tabs, capture, storage, server export
- Shared components (IconButtonToggle, Tooltip) in shared/components/
- Build scripts in scripts/ are CJS for Node.js compatibility
- Firefox builds require post-processing (manifest rewrite, content script fixup, bundle sanitization)
- Largest test files: pruner.test.ts (1317 lines), formatter.test.ts (1222 lines)
