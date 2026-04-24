# UTILS KNOWLEDGE BASE

**Scope:** Data processing utilities

## OVERVIEW
Data transformation, filtering, redaction, and token estimation utilities. Pure functions for log processing. Note: console-bootstrap.mjs is a MAIN world content script, not a pure utility.

## STRUCTURE
```
utils/
├── filters.ts               # Console & network filtering logic
├── filtered-data.ts         # FilteredPanelData helpers
├── debounce.ts              # Generic debounce utility
├── formatter.ts             # Markdown export generation (main entry)
├── formatter-console.ts     # Console markdown formatting
├── formatter-network.ts     # Network markdown formatting
├── formatter-strings.ts     # String utilities (escape, truncate)
├── pruner.ts                # Data size reduction
├── consolidation.ts          # Log consolidation and signal ranking
├── redact.ts                # Data redaction utilities
├── token-estimate.ts        # Token count estimation for export sizing
├── console-bootstrap.mjs    # MAIN world content script (patches console/fetch/XHR)
├── filters.test.ts          # Filter tests
├── formatter.test.ts        # Formatter tests
└── pruner.test.ts           # Pruner tests (largest)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Console regex filter | filters.ts | filterConsole() with fallback |
| Network pattern filter | filters.ts | filterNetwork() with include/exclude |
| Filtered panel data | filtered-data.ts | getFilteredPanelData(), FilteredPanelData interface |
| Debounce utility | debounce.ts | Generic debounce helper |
| Markdown export | formatter.ts | formatMarkdown() main entry |
| Console formatting | formatter-console.ts | Console log → Markdown table |
| Network formatting | formatter-network.ts | HAR entry → Markdown |
| String escape | formatter-strings.ts | Markdown special chars |
| Bytes formatting | formatter.ts | formatBytes() helper |
| Console pruning | pruner.ts | pruneConsole() truncates messages |
| Network pruning | pruner.ts | pruneNetwork() removes binary |
| Binary detection | pruner.ts | isBinaryContent() by MIME type |
| Log consolidation | consolidation.ts | Group logs by signal ranking |
| Failure detection | consolidation.ts | isLikelyFailureSignal() patterns |
| Timestamp formatting | consolidation.ts | formatTimestampRange() ranges |
| Data redaction | redact.ts | Sensitive data redaction |
| Token estimation | token-estimate.ts | Token count for export sizing |
| Console bootstrap | console-bootstrap.mjs | MAIN world: patches console/fetch/XHR |

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
- Console: 500 chars. Bodies: 10KB. Binary: image/, video/, audio/, font/.

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
