# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-25
**Commit:** 802d128
**Branch:** main

## OVERVIEW
Chrome DevTools extension capturing Console & Network logs in Markdown format optimized for LLM debugging. TypeScript + Manifest V3 + React (panel UI).

## STRUCTURE
```
./
├── panel/          # DevTools panel UI (React + non-React code)
│   ├── src/        # React components and hooks
│   │   ├── components/  # UI components
│   │   │   └── controls/  # Filter controls and action buttons
│   │   └── hooks/       # React hooks (useCaptureData, useToast)
│   ├── state.ts    # State interface
│   ├── capture.ts  # Console & network capture
│   ├── export.ts   # Markdown export
│   └── preview.ts  # Preview rendering
├── utils/          # Pure functions (filters, formatter, pruner, consolidation)
│   ├── filters.ts      # Console & network filtering
│   ├── formatter.ts    # Main formatter entry
│   ├── formatter-console.ts  # Console markdown formatting
│   ├── formatter-network.ts   # Network markdown formatting
│   ├── formatter-strings.ts   # String utilities
│   ├── pruner.ts       # Data pruning (binary removal, truncation)
│   └── consolidation.ts  # Log consolidation and signal ranking
├── types/          # Type definitions (ConsoleMessage, HAREntry)
├── browser-apis/   # Cross-browser API abstractions
│   └── index.ts     # Unified browser API exports
├── icons/          # Extension icons
├── manifest.json   # Manifest V3 config
├── devtools.js     # DevTools entry point
├── vite.config.ts  # Vite bundler config
├── biome.json      # Biome linting/formatting config
└── tsconfig.json   # TypeScript strict mode config
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Main UI logic | panel/src/App.tsx, panel/src/hooks/useCaptureData.ts | React components, state management |
| Filter logic | utils/filters.ts | Console & network filtering |
| Export formatting | utils/formatter.ts | Markdown generation |
| Data pruning | utils/pruner.ts | Binary removal, truncation |
| Log consolidation | utils/consolidation.ts | Signal ranking, failure detection |
| Type definitions | types/*.ts | ConsoleMessage, HAREntry interfaces |
| Browser APIs | browser-apis/index.ts | Cross-browser API abstractions |
| Extension config | manifest.json | Manifest V3 config |
| DevTools entry | devtools.js, devtools.html | Panel initialization |
| Build config | tsconfig.json | Strict mode, ES2020 target |
| Test setup | vitest.setup.ts | Chrome API mocks for tests |
| Test coverage | */*.test.ts | Vitest tests colocated with source |

## CONVENTIONS

**TypeScript:**
- Strict mode enabled (noImplicitAny, strictNullChecks)
- ES2020 target with DOM lib
- Explicit return types on public methods
- JSDoc comments for all exported functions

**Code Style:**
- 2-space indentation, 100-char line width (Biome config)
- Single quotes, semicolons as needed
- Biome for linting/formatting (replaces ESLint/Prettier)

**Naming:**
- PascalCase for classes and interfaces
- camelCase for functions and variables
- Descriptive names (e.g., `filteredConsoleLogs` not `logs`)

**Imports:**
- Always use explicit paths (../types/console)
- Group by: external libs, types, utils

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER mutate state directly** - Use spread operator for immutable updates
- **NEVER use implicit any** - Strict mode catches these
- **NEVER skip error handling** - All async operations have try/catch
- **NEVER commit large unfiltered data** - Pruner removes binary/large payloads
- **ALWAYS debounce filter inputs** - 300ms debounce in panel.ts

## UNIQUE STYLES

**Console Capture:**
- Injects script via `chrome.devtools.inspectedWindow.eval()`
- Patches console methods to capture logs
- Stores in `window.__loggyConsoleLogs` on inspected page

**Network Capture:**
- Uses `chrome.devtools.network.getHAR()` API
- Filters by include/exclude patterns (prefix with `-` to exclude)

**Data Pruning:**
- Auto-removes binary content (images, videos, PDFs)
- Truncates console messages at 500 chars
- Truncates request/response bodies at 10KB

**Log Consolidation:**
- Groups related logs by signal ranking
- Identifies failure patterns for debugging
- Formats timestamp ranges for grouped events

## COMMANDS

```bash
# Build (multi-step: Vite → TypeScript → Copy)
npm run build

# Lint
npm run lint
npm run lint:fix

# Format
npm run format

# Type check
npx tsc --noEmit

# Run tests
npm test                # Watch mode
npm run test:run        # Single run
npm run test:ui         # UI mode

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select this directory
```

## NOTES

- DevTools extension runs in isolated context from inspected page
- Console logs captured via script injection, not DevTools API
- HAR data retrieved directly from DevTools network API
- All data processing happens client-side (no external servers)
- Clipboard access requires user gesture (button click)
- Panel communicates with inspected window via `eval()` only
- Tests colocated with source files (e.g., filters.test.ts next to filters.ts)
- Panel uses dual architecture: React UI (src/) + legacy vanilla JS (root files)
- No background/service workers or content scripts - devtools_page only
- Husky git hooks configured for pre-commit linting/formatting
- Cross-browser support via browser-apis/ abstraction layer
- React components follow stateless composition pattern (controls receive all state via props)
- Hooks use ref-based side effect management to avoid re-renders
- Largest test file: utils/pruner.test.ts (894 lines) with comprehensive MIME type coverage
