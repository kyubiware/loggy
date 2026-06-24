# UTILS KNOWLEDGE BASE

**Scope:** Data processing utilities

## OVERVIEW
Data transformation, filtering, redaction, and token estimation utilities. Pure functions for log processing. Note: console-bootstrap.mjs is a MAIN world content script, not a pure utility.

## STRUCTURE
```
utils/
├── filters.ts                    # filterConsole (regex), filterNetwork (include/exclude)
├── filtered-data.ts              # getFilteredPanelData() — FilteredPanelData derivation
├── formatter.ts                  # formatMarkdown() main entry, formatBytes()
├── formatter-console.ts          # console → Markdown table
├── formatter-network.ts          # HAR entry → Markdown (delegates to formatter-network-sections)
├── formatter-network-sections.ts # body/headers sections; smart-mode elision; truncateJSON (MAX_BODY_LENGTH=8000)
├── formatter-strings.ts          # escape, truncate, bytes utilities
├── pruner.ts                     # binary removal (image/, video/, audio/, font/, octet-stream, pdf), body truncation
├── consolidation.ts              # console-side signal ranking + failure grouping
├── consolidation-network.ts      # network-side consolidation helpers
├── elevated-paths.ts             # smart-mode elevation: non-2xx OR URL matches console error/warn
├── schema-sketch.ts              # sketchJsonBody — one-line schema for non-elevated smart-mode
├── route-patterns.ts             # normalizeRoutePattern (UUID/numeric), groupRoutesByPattern
├── is-local-page.ts              # local page detection (consent auto-allow)
├── redact.ts                     # sensitive data redaction
├── token-estimate.ts             # token count for export sizing
├── debounce.ts                   # generic debounce helper
├── clipboard.ts                  # writeClipboard — async Clipboard API + textarea fallback
├── debug-logger.ts               # debugLog ring buffer (exported when __DEBUG__=true)
├── console-bootstrap.mjs         # MAIN world content script (patches console/fetch/XHR)
├── console-bootstrap.mjs.d.ts    # Type declarations for the MAIN world script
├── filters.test.ts               # filter tests
├── filtered-data.test.ts         # filtered-data tests
├── formatter.test.ts             # formatter tests (~1314 lines, second-largest test in repo)
├── formatter-network.test.ts     # formatter-network tests (~928 lines)
├── formatter-strings.test.ts     # formatter-strings tests
├── pruner.test.ts                # pruner tests (~1348 lines, LARGEST test file in repo)
├── consolidation-network.test.ts # network consolidation tests
├── redact.test.ts                # redact tests
├── route-patterns.test.ts        # route normalization tests
├── schema-sketch.test.ts         # schema sketch tests
└── console-bootstrap.test.mjs    # MAIN world script tests (runs as .mjs, not via vitest)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Console regex filter | filters.ts | filterConsole() with fallback |
| Network pattern filter | filters.ts | filterNetwork() with include/exclude |
| Filtered panel data | filtered-data.ts | getFilteredPanelData(), FilteredPanelData interface |
| Debounce utility | debounce.ts | Generic debounce helper |
| Markdown export | formatter.ts | formatMarkdown() main entry, formatBytes() |
| Console formatting | formatter-console.ts | Console log → Markdown table |
| Network formatting | formatter-network.ts | HAR entry → Markdown |
| Network body sections | formatter-network-sections.ts | smart-mode elision, truncateJSON (MAX_BODY_LENGTH=8000) |
| String escape | formatter-strings.ts | Pipes/backticks/asterisks, truncate, formatBytes |
| Console pruning | pruner.ts | pruneConsole() truncates to 500 chars |
| Network pruning | pruner.ts | pruneNetwork() removes binary by MIME prefix |
| Binary detection | pruner.ts | isBinaryContent() — image/, video/, audio/, font/, application/octet-stream, application/pdf |
| Console consolidation | consolidation.ts | Group logs by signal ranking |
| Network consolidation | consolidation-network.ts | Network-side consolidation helpers |
| Failure detection | consolidation.ts | isLikelyFailureSignal() patterns |
| Timestamp formatting | consolidation.ts | formatTimestampRange() ranges |
| Smart-mode elevation | elevated-paths.ts | non-2xx status OR URL pathname matches console error/warn substring |
| Body schema sketch | schema-sketch.ts | sketchJsonBody() — one-line schema for non-elevated smart-mode |
| Route normalization | route-patterns.ts | normalizeRoutePattern (UUID + numeric segments → :id), groupRoutesByPattern |
| Local page detection | is-local-page.ts | Used by consent auto-allow |
| Data redaction | redact.ts | Sensitive data redaction |
| Token estimation | token-estimate.ts | Token count for export sizing |
| Clipboard write | clipboard.ts | writeClipboard — async API + hidden-textarea fallback |
| Debug logging | debug-logger.ts | debugLog ring buffer, included in Markdown when __DEBUG__=true |
| Console bootstrap | console-bootstrap.mjs | MAIN world: patches console/fetch/XHR, stores in window.__loggy{Console,Network}Logs |

## CONVENTIONS

- **Pure functions**: No side effects, inputs → outputs
- **Null safety**: Check with `?.` and `||` fallbacks
- **String truncation**: Use truncate() with "... [truncated]" indicator
- **MIME type handling**: Case-insensitive comparisons

## ANTI-PATTERNS

- NEVER mutate input arrays - always return new arrays
- NEVER skip MIME type checks before processing content
- NEVER log to console from utility functions (keep pure)

## NOTES

**Modular Formatters:**
- formatter.ts: Main entry point
- formatter-console.ts: Console → Markdown table
- formatter-network.ts: HAR entry → Markdown table
- formatter-strings.ts: Escape, truncate, bytes utils

**Filter Syntax:**
- Console: Regex (e.g., `error|warn`) with string fallback
- Network: Space-separated, `-` prefix for exclude (e.g., `api.v1 -*.png`)

**Panel Filtering Helpers:**
- filtered-data.ts: derives filtered panel data from capture state
- debounce.ts: shared generic debounce helper used by panel hooks

**Pruning Limits:**
- Console: 500 chars (`PRUNE_CONFIG.MAX_LOG_LENGTH`); stack traces limited to 3 frames via console-bootstrap.mjs `formatError().slice(0, 3)`.
- Request/response bodies: 8000 chars (`MAX_BODY_LENGTH` in formatter-network-sections.ts; JSON-aware via `truncateJSON`).
- Binary removed by MIME prefix: `image/`, `video/`, `audio/`, `font/`, `application/octet-stream`, `application/pdf`.

**Smart-Mode Response Body Elision** (`responseBodyMode: 'smart' | 'full'`, default `'smart'`):
- Smart mode shows full body only for elevated requests (non-2xx status OR URL pathname matches console error/warn message substring). Elevation logic in `elevated-paths.ts`.
- Non-elevated requests get a one-line schema sketch from `sketchJsonBody()` in `schema-sketch.ts`.
- Full mode emits raw body with no formatter-level truncation (pruner still applies).

**Consolidation Patterns:**
- Groups logs by signal ranking
- Identifies failure patterns (error, timeout, 5xx)
- Formats timestamp ranges

**Markdown Escape:**
- Pipes `|` → `\|`, Backticks `` ` `` → `` \` ``, Asterisks `*` → `\*`

**Console Capture:**
- console-bootstrap.mjs: MAIN world content script that patches console.*, fetch, XMLHttpRequest, and error handlers to capture page logs. Relayed via postMessage.

**Testing:**
- Colocated test files with comprehensive edge case coverage.
- pruner.test.ts is largest (~1317 lines).
- formatter.test.ts (~1222 lines) covers escaping and formatting.
