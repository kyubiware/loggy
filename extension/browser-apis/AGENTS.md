# BROWSER-APIS KNOWLEDGE BASE

**Scope:** Cross-browser API abstractions

## OVERVIEW
Build-time browser detection and unified API exports. Uses Vite define to select Chrome or Firefox implementations at compile time.

## STRUCTURE
```
browser-apis/
├── index.ts       # Barrel export with runtime selection
├── types.ts       # BrowserAPI interface definitions
├── chrome.ts      # Chrome-specific implementations
├── firefox.ts     # Firefox-specific implementations
└── index.test.ts  # Cross-browser compatibility tests
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| API selection | index.ts:10 | `__BROWSER__` define check |
| Type definitions | types.ts | BrowserAPI interface |
| Chrome impl | chrome.ts | chrome.* API wrappers |
| Firefox impl | firefox.ts | browser.* API wrappers |
| Tests | index.test.ts | Compatibility verification |

## CONVENTIONS

- **Build-time selection**: Uses `__BROWSER__` Vite define (not runtime detection)
- **Static imports**: Both chrome.ts and firefox.ts imported (tree-shaking handles rest)
- **Type exports**: Re-export BrowserAPI type from index.ts
- **Unified interface**: Same API surface regardless of target browser

## ANTI-PATTERNS

- NEVER use runtime browser detection - always use build-time define
- NEVER import browser APIs directly elsewhere - use this abstraction layer
- NEVER add browser-specific logic outside this directory

## NOTES

- `__BROWSER__` is replaced by Vite at build time ('chrome' or 'firefox')
- Conditional export: `__BROWSER__ === 'firefox' ? firefoxBrowser : chromeBrowser`
- All browser API calls must go through this layer for cross-browser support
- Extension manifest differences handled at build level (separate manifest files)
