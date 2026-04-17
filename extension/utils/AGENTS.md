# UTILS KNOWLEDGE BASE

**Scope:** Data processing utilities

## OVERVIEW
Data transformation and filtering utilities. Pure functions for console/network filtering, Markdown formatting, and data pruning.

## STRUCTURE
```
utils/
├── filters.ts               # Console & network filtering logic
├── formatter.ts             # Markdown export generation (main entry)
├── formatter-console.ts     # Console markdown formatting
├── formatter-network.ts     # Network markdown formatting
├── formatter-strings.ts     # String utilities (escape, truncate)
├── pruner.ts                # Data size reduction
├── consolidation.ts          # Log consolidation and signal ranking
├── filters.test.ts          # Filter tests
├── formatter.test.ts        # Formatter tests
└── pruner.test.ts           # Pruner tests (894 lines - largest)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Console regex filter | filters.ts:17-37 | filterConsole() with fallback |
| Network pattern filter | filters.ts:49-87 | filterNetwork() with include/exclude |
| Markdown export | formatter.ts | formatMarkdown() main entry |
| Console formatting | formatter-console.ts | Console log → Markdown table |
| Network formatting | formatter-network.ts | HAR entry → Markdown |
| String escape | formatter-strings.ts | Markdown special chars |
| Bytes formatting | formatter.ts | formatBytes() helper |
| Console pruning | pruner.ts:32-37 | pruneConsole() truncates messages |
| Network pruning | pruner.ts:44-82 | pruneNetwork() removes binary |
| Binary detection | pruner.ts:89-94 | isBinaryContent() by MIME type |
| Log consolidation | consolidation.ts | Group logs by signal ranking |
| Failure detection | consolidation.ts | isLikelyFailureSignal() patterns |
| Timestamp formatting | consolidation.ts | formatTimestampRange() ranges |

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
- formatter.ts: Main entry point, orchestrates all formatting
- formatter-console.ts: Handles console log → Markdown table conversion
- formatter-network.ts: Handles HAR entry → Markdown table conversion
- formatter-strings.ts: Utilities for escaping, truncating, formatting bytes

**Filter Syntax:**
- Console: Regex pattern (e.g., `error|warn`) with fallback to string matching
- Network: Space-separated, `-` prefix for exclude (e.g., `api.v1 -*.png`)

**Pruning Limits:**
- Console messages: 500 chars with "... [truncated]"
- Request/response bodies: 10KB
- Binary types: image/, video/, audio/, font/, application/octet-stream, application/pdf

**Consolidation Patterns:**
- Groups related logs by signal ranking
- Identifies failure patterns (error, timeout, 5xx status)
- Formats timestamp ranges for grouped events

**Markdown Escape:**
- Pipes `|` → `\|`
- Backticks `` ` `` → `` \` ``
- Asterisks `*` → `\*`

**Testing:**
- Colocated test files with comprehensive edge case coverage
- pruner.test.ts is largest (894 lines) with detailed MIME type testing
- formatter.test.ts (703 lines) covers escaping and formatting edge cases
