# LOGGY PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-22
**Commit:** 1bea433
**Branch:** main

## OVERVIEW
Monorepo with npm workspaces containing a Chrome/Firefox DevTools extension (captures Console & Network logs as Markdown) and a companion Fastify server for log exports.

## STRUCTURE
```
./
├── extension/         # Browser extension (TypeScript + React + Manifest V3)
│   ├── background/    # Service worker (index.ts + messages/ sub-module)
│   ├── capture/       # Debugger-based capture logic (Chrome-only)
│   ├── panel/         # DevTools panel UI (React + three-context provider)
│   ├── popup/         # Extension popup UI (React) — branches on chrome.debugger availability
│   ├── fab/           # Firefox Android floating action button (shadow DOM React)
│   ├── preview/       # Standalone Markdown preview page
│   ├── shared/        # Cross-UI components, hooks, and export pipeline
│   ├── utils/         # Pure data processing (filters, formatter, pruner, consolidation)
│   ├── types/         # Shared TypeScript definitions (console, HAR, messages, state)
│   ├── browser-apis/  # Cross-browser API abstractions (build-time selection)
│   ├── scripts/       # Build/release/install scripts (CJS)
│   └── manifest.json  # Manifest V3 config
├── serve/             # Fastify companion server (CLI + TUI + HTTP API)
│   ├── src/           # server.ts, cli.ts, tui.ts, clipboard.ts, tailscale.ts
│   ├── tests/         # Vitest tests
│   └── bin/           # CLI entry point
├── scripts/           # Repo-level release shell scripts (release-extension.sh, release-serve.sh)
├── .github/workflows/ # ci, sign-extension, release-extension, release-serve, screenshots, bump-version
└── package.json       # Workspace root
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Extension code | extension/ | See extension/AGENTS.md |
| Service worker | extension/background/ | Tab state, capture coordination, storage. Handlers in background/messages/ |
| Panel UI | extension/panel/ | DevTools panel (React three-context). Hooks in panel/src/hooks/ |
| Popup UI | extension/popup/ | Status display, debugger toggle. Two data paths: Chrome vs Firefox direct capture |
| FAB UI (Firefox Android) | extension/fab/ | Floating action button on-page |
| Preview page | extension/preview/ | Standalone Markdown preview |
| Shared layer | extension/shared/ | Cross-UI components + hooks + export pipeline. See shared/AGENTS.md |
| Data processing | extension/utils/ | Filters, formatter, pruner, consolidation |
| Type definitions | extension/types/ | ConsoleMessage, HAREntry, LoggyMessage, LoggyState |
| Browser APIs | extension/browser-apis/ | Chrome/Firefox build-time selection |
| Release automation | extension/scripts/ | Build, sign, publish, AMO, screenshots, installers — see scripts/AGENTS.md |
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
- Server runs interactive TUI by default (readline raw-mode), `--quiet` for plain logs
