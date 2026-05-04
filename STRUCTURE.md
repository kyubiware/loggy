# Codebase Structure

## Directory Layout

```text
loggy/
├── extension/          # Browser extension workspace (Manifest V3, React panel, background worker)
├── serve/              # Fastify companion server workspace
├── .github/            # CI workflows and issue templates
├── .husky/             # Git hooks
├── screenshots/        # Reference images and captured output
├── README.md           # Repo overview and usage guide
├── package.json        # Workspace scripts and dependencies
├── package-lock.json   # Locked workspace dependency graph
├── ARCHITECTURE.md     # Architecture overview
└── STRUCTURE.md        # Repository structure guide
```

## Directory Purposes

**`extension/`:**
- Purpose: Hold the browser extension implementation.
- Contains: Background logic, capture code, React panel UI, popup UI, shared utilities, browser API adapters, scripts, manifests, and tests.
- Key files: `extension/background/index.ts`, `extension/panel/src/main.tsx`, `extension/utils/formatter.ts`, `extension/manifest.json`, `extension/package.json`

**`serve/`:**
- Purpose: Hold the companion Fastify server.
- Contains: HTTP routes, CLI entry point, TUI rendering, clipboard helper, and tests.
- Key files: `serve/src/server.ts`, `serve/src/cli.ts`, `serve/src/tui.ts`, `serve/src/clipboard.ts`, `serve/package.json`

**`.github/`:**
- Purpose: Store repository automation.
- Contains: Workflows and issue templates.
- Key files: `.github/workflows/`

**`.husky/`:**
- Purpose: Store Git hooks.
- Contains: Hook entry scripts.
- Key files: `.husky/`

**`screenshots/`:**
- Purpose: Store image assets used for documentation or manual verification.
- Contains: Screenshot files.
- Key files: `screenshots/`

## Key File Locations

**Entry Points:** `extension/background/index.ts`, `extension/panel/src/main.tsx`, `serve/src/cli.ts` — start capture, render the panel, and launch the server CLI.
**Configuration:** `package.json`, `extension/package.json`, `serve/package.json`, `extension/manifest.json`, `extension/vite.config.ts` — define workspace scripts, package metadata, and build behavior.
**Core Logic:** `extension/utils/`, `extension/background/`, `extension/shared/`, `serve/src/server.ts` — implement filtering, formatting, message routing, export sync, and HTTP handling.
**Tests:** `extension/**/*.test.ts`, `extension/**/*.test.tsx`, `serve/tests/server.test.ts` — keep tests near the code they verify.

## Naming Conventions

**Files:** `*.ts`, `*.tsx`, `*.test.ts`, `*.test.tsx` — example: `extension/utils/formatter.ts`.
**Directories:** feature- or layer-based names — example: `extension/background/`, `extension/panel/src/components/`.

## Where to Add New Code

**New capture logic:** `extension/capture/` or `extension/background/` — keep browser capture orchestration in the extension runtime.
**New panel UI:** `extension/panel/src/components/` or `extension/panel/src/hooks/` — keep React UI and hooks under the panel workspace.
**New shared utility:** `extension/utils/` or `extension/shared/` — keep pure formatting and reusable helpers here.
**New browser API wrapper:** `extension/browser-apis/` — keep browser-specific abstractions behind build-time selection.
**New server route or helper:** `serve/src/` — keep Fastify handlers, CLI behavior, and clipboard support together.
**Tests:** colocate with source as `*.test.ts` or `*.test.tsx`.
