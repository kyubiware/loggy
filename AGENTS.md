# LOGGY PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-24
**Commit:** d9311e7
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
│   ├── popup/         # Extension popup UI (React) — branches on build-time __BROWSER__ define
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
| Popup UI | extension/popup/ | Status display, debugger toggle. Two data paths branched on `__BROWSER__` (Chrome vs Firefox direct capture). See popup/AGENTS.md |
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

# Dev server (Chrome + Firefox concurrent)
npm run dev

# Run all tests (extension + serve)
npm test

# Full CI gate (typecheck + lint + browser-apis lint + tests Chrome/Firefox + serve tests)
npm run ci

# Lint (Biome)
npm run lint
npm run lint:fix

# Format
npm run format

# Type check
npm run typecheck --workspace=extension   # extension (tsc --noEmit)
npm run typecheck --workspace=serve        # serve

# Browser-API boundary lint (CI-enforced — chrome.* only in browser-apis/)
npm run lint:browser-apis --workspace=extension

# Publish serve to npm
npm run publish:serve

# Release scripts (repo-level)
npm run release:extension:patch | minor | major
npm run release:serve:patch | minor | major
```

## NOTES

- Extension has background service worker, content scripts, AND DevTools panel (not DevTools-only)
- Multi-layered message passing: background ↔ panel/popup via runtime.sendMessage, content scripts via postMessage relay
- Three capture modes: debugger (Chrome only), content-script, devtools
- Console capture uses MAIN world content script to patch page globals (non-standard)
- Cross-browser builds via Vite `__BROWSER__` define + separate manifest variants
- Firefox signing/publishing via web-ext CLI
- Husky pre-commit hook lives in `extension/.husky/pre-commit` (runs biome check); not at repo root
- Server runs interactive TUI by default (readline raw-mode), `--quiet` for plain logs
- Server auto-detects Tailscale HTTPS — provisions TLS certs when tailnet HTTPS is enabled
- Test coverage gaps (no colocated tests): `extension/capture/`, `extension/fab/`, `extension/content-relay.ts`, `extension/devtools.mjs`, `extension/background/messages/` (only `export-handlers.test.ts`)
