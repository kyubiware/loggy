# Architecture

## Pattern Overview

**Overall:** Dual-workspace browser extension with a companion Fastify export server

**Key Characteristics:**
- Use `extension/` for browser capture, filtering, export formatting, and panel/popup UI.
- Use `serve/` for HTTP ingestion, CLI control, TUI status, and optional Tailscale HTTPS.
- Use build-time browser selection through `extension/browser-apis/` instead of runtime detection.

## Layers

**Extension runtime:**
- Purpose: Capture console and network data, manage per-tab state, and build exports.
- Location: `extension/background/index.ts`, `extension/background/content-scripts.ts`, `extension/background/storage.ts`, `extension/capture/`, `extension/types/`, `extension/utils/`, `extension/shared/`
- Contains: Service worker orchestration, capture adapters, shared types, filtering, pruning, Markdown formatting, and server sync.
- Depends on: `chrome.*` APIs, `extension/browser-apis/`, `extension/types/`, `extension/utils/`, `extension/shared/`
- Used by: `extension/panel/src/main.tsx`, `extension/popup/main.tsx`, content scripts, and browser events.

**Panel UI:**
- Purpose: Render the DevTools panel and manage capture controls, filters, and export actions.
- Location: `extension/panel/src/main.tsx`, `extension/panel/src/App.tsx`, `extension/panel/src/LoggyContext.tsx`, `extension/panel/src/components/`, `extension/panel/src/hooks/`
- Contains: React root, context providers, hooks, action handlers, and panel components.
- Depends on: `extension/types/`, `extension/utils/`, `extension/shared/`
- Used by: DevTools panel entry point.

**Popup UI:**
- Purpose: Render the browser-action popup and provide a compact control surface.
- Location: `extension/popup/main.tsx`, `extension/popup/components/`, `extension/popup/hooks/`, `extension/popup/constants.ts`
- Contains: React root, popup view, and popup-specific helpers.
- Depends on: `extension/shared/`, `extension/utils/`, `extension/types/`
- Used by: Browser popup entry point.

**Shared export pipeline:**
- Purpose: Convert captured state into Markdown and optionally push it to the server.
- Location: `extension/shared/export.ts`, `extension/shared/server-export.ts`, `extension/utils/formatter.ts`, `extension/utils/filtered-data.ts`, `extension/utils/pruner.ts`
- Contains: Data filtering, redaction, pruning, Markdown formatting, and server push helpers.
- Depends on: `extension/browser-apis/`, `extension/types/`, `extension/utils/`
- Used by: Background runtime and panel actions.

**Server runtime:**
- Purpose: Receive Markdown exports over HTTP and expose the latest export through CLI and TUI flows.
- Location: `serve/src/server.ts`, `serve/src/cli.ts`, `serve/src/tui.ts`, `serve/src/clipboard.ts`, `serve/src/tailscale.ts`
- Contains: Fastify app factory, CLI argument parsing, TUI rendering, clipboard integration, and Tailscale HTTPS detection.
- Depends on: `fastify`, `@fastify/cors`, `clipboardy`, `update-notifier`, and the `tailscale` CLI for HTTPS mode.
- Used by: `loggy` CLI, browser extension server sync, direct API clients, and local automation.

**Release automation:**
- Purpose: Build, package, sign, and publish Firefox extension artifacts.
- Location: `extension/scripts/release.cjs`, `extension/scripts/bump-version.cjs`, `extension/scripts/prepare-source-zip.cjs`, `extension/scripts/fix-devtools-module.cjs`, `extension/scripts/rewrite-firefox-manifest.cjs`, `extension/scripts/sanitize-firefox-bundle.cjs`, `extension/scripts/fix-content-scripts.cjs`, `extension/scripts/update-amo-description.cjs`, `extension/scripts/upload-amo-screenshots.cjs`, `.github/workflows/release-extension.yml`, `.github/workflows/sign-extension.yml`, `.github/workflows/bump-version.yml`
- Contains: Release orchestration, Firefox bundle post-processing, AMO description updates, screenshot upload, and version bump automation.
- Depends on: `web-ext`, `dotenv-cli`, GitHub Actions, and Firefox build outputs.
- Used by: Firefox release, signing, AMO publishing, and versioning workflows.

**Workspace configuration:**
- Purpose: Define package boundaries, scripts, and shared project rules.
- Location: `package.json`, `extension/package.json`, `serve/package.json`, `extension/manifest.json`, `extension/scripts/`
- Contains: npm workspaces, build/test/lint scripts, package metadata, extension packaging inputs, and release helper scripts.
- Depends on: npm workspaces and Node.js 24+.
- Used by: Development commands and release pipelines.

## Data Flow

**Capture to export pipeline:**

1. Browser events enter the background service worker through runtime messages and capture callbacks — `extension/background/index.ts`
2. The background worker persists tab state, stores captured entries in session storage, and syncs consent/state to the extension UI — `extension/background/index.ts`, `extension/background/storage.ts`
3. The shared export pipeline filters, prunes, and formats console/network data into Markdown — `extension/shared/export.ts`, `extension/shared/server-export.ts`, `extension/utils/filtered-data.ts`, `extension/utils/pruner.ts`, `extension/utils/formatter.ts`
4. The panel and popup render the current state, filters, and export actions from shared contexts and hooks — `extension/panel/src/main.tsx`, `extension/panel/src/LoggyContext.tsx`, `extension/popup/main.tsx`, `extension/popup/components/`

**Server export pipeline:**

1. The extension posts Markdown to `/loggy` when auto server sync is enabled — `extension/shared/export.ts`, `extension/shared/server-export.ts`
2. The server validates `text/plain`, updates in-memory state, and optionally writes to disk — `serve/src/server.ts`
3. The CLI exposes the latest export through `loggy print`, and the TUI exposes clipboard and status actions — `serve/src/cli.ts`, `serve/src/tui.ts`, `serve/src/clipboard.ts`
4. The server enables HTTPS with Tailscale certificates when available — `serve/src/tailscale.ts`, `serve/src/cli.ts`

## Key Abstractions

**`TabCaptureState`:**
- Purpose: Track capture mode, connection state, and per-tab log counts.
- Location: `extension/types/messages.ts`, `extension/background/index.ts`
- Pattern: In-memory state synchronized to `chrome.storage.session`.

**`LoggyState`:**
- Purpose: Hold panel filters, captured data, export settings, and server sync flags.
- Location: `extension/types/state.ts`, `serve/src/server.ts`
- Pattern: Shared state object with workspace-specific variants.

**`BrowserAPI`:**
- Purpose: Abstract browser-specific API differences behind a build-time selection.
- Location: `extension/browser-apis/types.ts`, `extension/browser-apis/index.ts`, `extension/browser-apis/chrome.ts`, `extension/browser-apis/firefox.ts`
- Pattern: Interface plus platform-specific implementations.

**`ExportData` / `formatMarkdown`:**
- Purpose: Represent captured page data and generate the final Markdown document.
- Location: `extension/utils/formatter.ts`
- Pattern: Pure transformation pipeline with helper formatters.

**`createServer()` / `startServer()`:**
- Purpose: Build and launch the Fastify API with CORS and export endpoints.
- Location: `serve/src/server.ts`
- Pattern: Factory plus start wrapper with explicit error handling.

**`TailscaleCertInfo`:**
- Purpose: Carry the HTTPS certificate bundle and hostname for Tailscale mode.
- Location: `serve/src/tailscale.ts`
- Pattern: Probe-and-return helper for optional HTTPS setup.

## Entry Points

**Background service worker:**
- Location: `extension/background/index.ts`
- Triggers: Extension install/startup, tab events, runtime messages, and capture messages.
- Responsibilities: Route messages, manage capture modes, persist state, export Markdown, and sync with the server.

**Panel UI:**
- Location: `extension/panel/src/main.tsx`
- Triggers: DevTools panel load.
- Responsibilities: Mount the React app that drives capture controls and preview rendering.

**Popup UI:**
- Location: `extension/popup/main.tsx`
- Triggers: Browser action popup load.
- Responsibilities: Mount the popup React app and initialize popup interactions.

**Server CLI:**
- Location: `serve/src/cli.ts`
- Triggers: `loggy`, `loggy print`, `--version`, and process signals.
- Responsibilities: Parse flags, start the server, render the TUI, and print the latest export.

**Server HTTP API:**
- Location: `serve/src/server.ts`
- Triggers: `POST /loggy`, `GET /loggy/export`, and `GET /loggy/handshake`.
- Responsibilities: Validate exports, expose handshake metadata, and serve the latest Markdown.

## Error Handling

**Strategy:** Use explicit validation, guarded async operations, sentinel 400/404 responses, and fail-closed defaults.

## Cross-Cutting Concerns

**Logging:** Use `console.error()` for CLI startup failures and transient TUI/status messages for operator feedback.
**Caching:** Use in-memory maps for tab state, route options, and preview caching, plus `chrome.storage.session` for per-tab persistence.
**Storage:** Use `chrome.storage.session` and `chrome.storage.local` in the extension; use in-memory state and optional file writes in `serve/`.
