# Codebase Structure

## Directory Layout

```text
loggy/
├── extension/          # Browser extension workspace (Manifest V3, background worker, panel, popup)
├── serve/              # Fastify companion server workspace (CLI, TUI, HTTP API)
├── .github/            # CI workflows and repository automation (CI, signing, release, version bumps)
├── .husky/             # Git hooks
├── ARCHITECTURE.md     # Architecture overview
├── STRUCTURE.md        # Repository structure guide
├── README.md           # Repo overview and usage guide
├── package.json        # Workspace scripts and dependencies
├── package-lock.json   # Locked workspace dependency graph
├── loggy_icon.png      # Repo-level icon asset
├── loggy_icon_base.png # Repo-level icon asset
├── test-jwt.cjs        # Local verification script
└── test-run.js         # Local verification script
```

## Directory Purposes

**`extension/`:**
- Purpose: Hold the browser extension implementation.
- Contains: Background logic, capture code, React panel UI, popup UI, FAB UI (Firefox Android), preview page, shared utilities, shared React components and hooks, browser API adapters, scripts, manifests, tests, and build outputs.
- Key files: `extension/background/index.ts`, `extension/content-relay.ts`, `extension/panel/src/main.tsx`, `extension/panel/server-probe.ts`, `extension/popup/main.tsx`, `extension/preview/preview.tsx`, `extension/fab-ui.tsx`, `extension/utils/formatter.ts`, `extension/utils/clipboard.ts`, `extension/manifest.json`, `extension/package.json`

**`serve/`:**
- Purpose: Hold the companion Fastify server.
- Contains: HTTP routes, CLI entry point, TUI rendering, clipboard helper, Tailscale HTTPS detection, and tests.
- Key files: `serve/src/server.ts`, `serve/src/cli.ts`, `serve/src/tui.ts`, `serve/src/clipboard.ts`, `serve/src/tailscale.ts`, `serve/package.json`

**`.github/`:**
- Purpose: Store repository automation.
- Contains: CI, signing, release, and version-bump workflows plus issue templates.
- Key files: `.github/workflows/`

**`extension/scripts/`:**
- Purpose: Hold build, packaging, AMO metadata, and Firefox release automation.
- Contains: Release orchestration, manifest rewrite helpers, Firefox bundle sanitizers, AMO description updates, and screenshot upload scripts.
- Key files: `extension/scripts/release.cjs`, `extension/scripts/update-amo-description.cjs`, `extension/scripts/upload-amo-screenshots.cjs`, `extension/scripts/amo-description.md`

**`extension/fab/`:**
- Purpose: Hold the floating action button UI injected as a content script on Firefox Android.
- Contains: Shadow DOM-mounted React component tree with capture toggle and clipboard export state.
- Key files: `extension/fab-ui.tsx`, `extension/fab/FabContainer.tsx`, `extension/fab/useFabState.ts`, `extension/fab/fab.css`

**`extension/preview/`:**
- Purpose: Hold the standalone Markdown preview page launched from the popup.
- Contains: React root, rendered/raw toggle, cached markdown retrieval via runtime messaging.
- Key files: `extension/preview/preview.tsx`, `extension/preview/preview.html`, `extension/preview/index.css`

**`extension/shared/components/`:**
- Purpose: Hold reusable React UI primitives used across panel, popup, and FAB layers.
- Contains: Icon button toggles, tooltips, option checkboxes.
- Key files: `extension/shared/components/IconButtonToggle.tsx`, `extension/shared/components/Tooltip.tsx`, `extension/shared/components/OptionCheckbox.tsx`

**`extension/shared/hooks/`:**
- Purpose: Hold reusable React hooks shared across extension UIs.
- Contains: Debounced filter input hook.
- Key files: `extension/shared/hooks/useDebouncedFilter.ts`

**`.husky/`:**
- Purpose: Store Git hooks.
- Contains: Hook entry scripts.
- Key files: `.husky/`

**`screenshots/`:**
- Purpose: Store image assets used for documentation or manual verification.
- Contains: Screenshot files.
- Key files: `screenshots/`

**Repository root files:**
- Purpose: Keep workspace-level docs, scripts, and shared configuration.
- Contains: Workspace manifests, documentation, icon assets, and local helper scripts.
- Key files: `README.md`, `package.json`, `ARCHITECTURE.md`, `STRUCTURE.md`, `test-jwt.cjs`, `test-run.js`, `loggy_icon.png`, `loggy_icon_base.png`

## Key File Locations

**Entry Points:** `extension/background/index.ts`, `extension/panel/src/main.tsx`, `extension/popup/main.tsx`, `serve/src/cli.ts` — start capture, render the extension UIs, and launch the server CLI.
**Configuration:** `package.json`, `extension/package.json`, `serve/package.json`, `extension/manifest.json`, `extension/manifest-chrome.json`, `extension/manifest-firefox.json`, `extension/vite.config.ts` — define workspace scripts, package metadata, and build behavior.
**Core Logic:** `extension/utils/`, `extension/background/`, `extension/shared/`, `extension/browser-apis/`, `extension/content-relay.ts`, `serve/src/server.ts`, `serve/src/tailscale.ts` — implement filtering, formatting, message routing, export sync, browser abstraction, content relay, HTTP handling, and HTTPS setup.
**Release Automation:** `extension/scripts/` — keep release orchestration, Firefox post-processing, AMO description updates, screenshot upload, and packaging helpers together.
**Tests:** `extension/**/*.test.ts`, `extension/**/*.test.tsx`, `serve/tests/server.test.ts` — keep tests near the code they verify.

## Naming Conventions

**Files:** `*.ts`, `*.tsx`, `*.test.ts`, `*.test.tsx` — example: `extension/utils/formatter.ts`.
**Directories:** feature- or layer-based names — example: `extension/background/`, `extension/panel/src/components/`.

## Where to Add New Code

**New capture logic:** `extension/capture/` or `extension/background/` — keep browser capture orchestration in the extension runtime.
**New panel UI:** `extension/panel/src/components/` or `extension/panel/src/hooks/` — keep React UI and hooks under the panel workspace.
**New popup UI:** `extension/popup/` — keep compact browser-action controls and popup state together.
**New shared utility:** `extension/utils/` — keep pure formatting helpers here.
**New shared React component:** `extension/shared/components/` — keep reusable UI primitives (IconButtonToggle, Tooltip, OptionCheckbox) that cross UI boundaries.
**New shared React hook:** `extension/shared/hooks/` — keep reusable hooks (useDebouncedFilter) that cross UI boundaries.
**New FAB UI (Firefox Android):** `extension/fab/` — keep FAB container, state hook, and CSS in the fab directory.
**New preview page:** `extension/preview/` — keep standalone Markdown preview React component, HTML shell, and styles.
**New browser API wrapper:** `extension/browser-apis/` — keep browser-specific abstractions behind build-time selection.
**New server route or helper:** `serve/src/` — keep Fastify handlers, CLI behavior, Tailscale HTTPS setup, and clipboard support together.
**New release or AMO automation:** `extension/scripts/` — keep packaging helpers, description generation, screenshot upload, and Firefox release tasks together.
**Tests:** colocate with source as `*.test.ts` or `*.test.tsx`.
