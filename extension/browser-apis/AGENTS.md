# BROWSER-APIS KNOWLEDGE BASE

**Scope:** Cross-browser API abstractions

## OVERVIEW
Build-time browser detection and unified API exports. Uses Vite `__BROWSER__` define to select Chrome or Firefox implementations at compile time. CI-enforced boundary prevents `chrome.*` imports outside this directory.

## STRUCTURE
```
browser-apis/
├── index.ts                  # Barrel export with build-time __BROWSER__ selection
├── types.ts                  # BrowserAPI interface
├── chrome.ts                 # Chrome-specific implementations (event sinks = lazy getters)
├── firefox.ts                # Firefox-specific implementations (event sinks = lazy getters)
├── SURFACE_AUDIT.md          # Documents which surfaces exist per browser + edge-case patterns (D10/D13/D14)
├── index.test.ts             # Cross-browser compatibility tests
├── chrome.test.ts            # Chrome impl tests
├── firefox.test.ts           # Firefox impl tests
└── surface-coverage.test.ts  # Coverage tracker (~456 lines)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| API selection | index.ts | `__BROWSER__ === 'firefox' ? firefoxBrowser : chromeBrowser` |
| Type definitions | types.ts | BrowserAPI interface |
| Chrome impl | chrome.ts | chrome.* wrappers — event sinks MUST be lazy getters |
| Firefox impl | firefox.ts | browser.* wrappers — event sinks MUST be lazy getters |
| Surface audit | SURFACE_AUDIT.md | Per-browser API coverage; D10 (Promise overloads), D13 (sendMessageWithLastError), D14 (EventSink identity) |
| Tests | *.test.ts | chrome, firefox, index, surface-coverage |
| Boundary lint | ../scripts/check-browser-apis-boundary.cjs | TS-AST gate; allowlist in scripts/browser-apis-allowlist.json |

## CONVENTIONS

- **Build-time selection**: Uses `__BROWSER__` Vite define (not runtime detection)
- **Static imports**: Both chrome.ts and firefox.ts imported statically; Rollup tree-shakes the unused branch
- **Lazy event sinks**: `eventSink(global.X.Y)` references in the `chromeBrowser` / `firefoxBrowser` object literals MUST be `get onX() { return eventSink(global.X.Y); }`, never eager property values — eager values evaluate at module load and leak into the wrong-browser bundle (see project memory 234)
- **devtools.inspectedWindow.tabId** is already a getter; `devtools.panels.create` is a function (lazy)
- **Type exports**: Re-export BrowserAPI type from index.ts

## ANTI-PATTERNS

- NEVER use runtime browser detection — always use build-time define
- NEVER import browser APIs directly elsewhere — use this abstraction layer
- NEVER add browser-specific logic outside this directory
- NEVER use eager property values for event sinks in the browser object literals — they crash the wrong-browser bundle at module load
- NEVER lower `browser-apis-allowlist.json` counts without verifying the leak is gone — leaks fail CI

## NOTES

- `__BROWSER__` is replaced by Vite at build time ('chrome' or 'firefox')
- Tests that override an event sink must use `Object.defineProperty` — the getter-only property blocks direct assignment (see `useCaptureData.test.tsx`)
- Extension manifest differences handled at build level (separate `manifest-chrome.json` / `manifest-firefox.json`)
- `check-browser-apis-boundary.cjs` uses the TypeScript compiler API (not regex) — comments and string literals are NOT flagged
