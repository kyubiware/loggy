# LOGGY PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-22
**Commit:** 6263307
**Branch:** main

## OVERVIEW
Monorepo with npm workspaces containing a Chrome/Firefox DevTools extension (captures Console & Network logs as Markdown) and a companion Fastify server for log exports.

## STRUCTURE
```
./
├── extension/         # Browser extension (TypeScript + React + Manifest V3)
│   ├── background/    # Service worker (message routing, capture modes, storage)
│   ├── capture/       # Debugger-based capture logic
│   ├── panel/         # DevTools panel UI (React + vanilla JS dual architecture)
│   ├── popup/         # Extension popup UI (React)
│   ├── utils/         # Pure data processing (filters, formatter, pruner, consolidation)
│   ├── types/         # Shared TypeScript definitions (console, HAR, messages)
│   ├── browser-apis/  # Cross-browser API abstractions (build-time selection)
│   ├── shared/        # Shared React components (IconButtonToggle, Tooltip)
│   ├── scripts/       # Build/release scripts (CJS)
│   └── manifest.json  # Manifest V3 config
├── serve/             # Fastify companion server (CLI + TUI + HTTP API)
│   ├── src/           # Server implementation (server.ts, tui.ts, clipboard.ts)
│   ├── tests/         # Vitest tests
│   └── bin/           # CLI entry point
└── package.json       # Workspace root
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Extension code | extension/ | See extension/AGENTS.md |
| Service worker | extension/background/ | Tab state, capture coordination, storage |
| Popup UI | extension/popup/ | Status display, debugger toggle |
| Panel UI | extension/panel/ | DevTools panel (React + vanilla) |
| Data processing | extension/utils/ | Filters, formatter, pruner, consolidation |
| Type definitions | extension/types/ | ConsoleMessage, HAREntry, LoggyMessage |
| Browser APIs | extension/browser-apis/ | Chrome/Firefox build-time selection |
| Server code | serve/ | Fastify API + interactive TUI |
| Workspace config | package.json | Workspaces: ["extension", "serve"] |

## CONVENTIONS

- npm workspaces (not pnpm/yarn)
- Biome for linting/formatting (not ESLint/Prettier)
- Vitest for testing (colocated in extension/, dedicated tests/ in serve/)
- Vite for extension bundling with CRXJS for dev HMR
- TypeScript strict mode in both workspaces
- Extension primary workspace with most tooling; server minimal

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER commit dist/ artifacts** — build outputs are gitignored
- **NEVER use runtime browser detection** — build-time `__BROWSER__` define only
- **NEVER import browser APIs directly** outside browser-apis/ — use abstraction layer
- **NEVER use implicit any** — strict mode catches these

## COMMANDS

```bash
# Build extension (Chrome + Firefox)
npm run build

# Dev server (Chrome HMR)
npm run dev

# Run all tests
npm test

# Lint (Biome)
npm run lint
npm run lint:fix

# Format
npm run format

# Type check (extension)
npx tsc --noEmit

# Publish serve to npm
npm run publish:serve
```

## NOTES

- Extension has background service worker, content scripts, AND DevTools panel (not DevTools-only)
- Multi-layered message passing: background ↔ panel/popup via runtime.sendMessage, content scripts via postMessage relay
- Three capture modes: debugger (Chrome only), content-script, devtools
- Console capture uses MAIN world content script to patch page globals (non-standard)
- Cross-browser builds via Vite `__BROWSER__` define + separate manifest variants
- Firefox signing/publishing via web-ext CLI
- Husky git hooks for pre-commit linting/formatting
- Server runs interactive TUI by default (bless-based), `--quiet` for plain logs
