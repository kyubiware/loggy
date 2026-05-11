# Architecture

## Pattern Overview

**Overall:** Dual-workspace browser extension with a companion Fastify export server

**Key Characteristics:**
- Use `extension/` for browser capture, filtering, export formatting, FAB UI, panel/popup UI, and standalone preview.
- Use `serve/` for HTTP ingestion, CLI control, TUI status, and optional Tailscale HTTPS.
- Use build-time browser selection through `extension/browser-apis/` instead of runtime detection.

## Layers

**Extension runtime:**
- Purpose: Capture console and network data, manage per-tab state, build exports, and handle server sync.
- Location: `extension/background/index.ts`, `extension/background/content-scripts.ts`, `extension/background/storage.ts`, `extension/capture/debugger-capture.ts`, `extension/types/`, `extension/utils/`, `extension/shared/`
- Contains: Service worker orchestration, capture adapters, shared types, filtering, pruning, Markdown formatting, server sync, clipboard fallback, and state persistence.
- Depends on: `chrome.*` APIs, `extension/browser-apis/`, `extension/types/`, `extension/utils/`, `extension/shared/`
- Used by: `extension/panel/src/main.tsx`, `extension/popup/main.tsx`, `extension/fab-ui.tsx`, `extension/preview/preview.tsx`, content scripts, and browser events.

**Panel UI:**
- Purpose: Render the DevTools panel and manage capture controls, filters, and export actions.
- Location: `extension/panel/src/main.tsx`, `extension/panel/src/App.tsx`, `extension/panel/src/LoggyContext.tsx`, `extension/panel/src/components/`, `extension/panel/src/hooks/`, `extension/panel/capture.ts`, `extension/panel/preview.ts`, `extension/panel/actions.ts`, `extension/panel/server-probe.ts`
- Contains: React root, context providers, hooks, action handlers, panel components, capture helpers, preview rendering, and server availability probe.
- Depends on: `extension/types/`, `extension/utils/`, `extension/shared/`, `extension/browser-apis/`
- Used by: DevTools panel entry point.

**Popup UI:**
- Purpose: Render the browser-action popup and provide a compact control surface.
- Location: `extension/popup/main.tsx`, `extension/popup/Popup.tsx`, `extension/popup/components/`, `extension/popup/hooks/`, `extension/popup/constants.ts`
- Contains: React root, popup view, popup-specific components and hooks, and settings management.
- Depends on: `extension/shared/`, `extension/utils/`, `extension/types/`
- Used by: Browser popup entry point.

**FAB UI (Firefox on Android):**
- Purpose: Render a floating action button directly on the page for Firefox Android where DevTools are unavailable.
- Location: `extension/fab-ui.tsx`, `extension/fab/FabContainer.tsx`, `extension/fab/useFabState.ts`, `extension/fab/fab.css`
- Contains: Shadow DOM-mounted React root, FAB container component, state management for capture toggling and clipboard export.
- Depends on: `extension/utils/clipboard.ts`, `extension/types/`, `chrome.runtime` APIs
- Used by: Firefox Android users, injected as a content script.

**Preview page:**
- Purpose: Display a standalone rendered Markdown preview of captured logs, launched from the popup.
- Location: `extension/preview/preview.tsx`, `extension/preview/preview.html`, `extension/preview/index.css`
- Contains: React root with rendered/raw view toggle, copy-to-clipboard button, and cached markdown retrieval via `chrome.runtime.sendMessage`.
- Depends on: `react-markdown`, `remark-gfm`, `extension/utils/clipboard.ts`, `chrome.runtime` APIs
- Used by: Popup "Preview" action.

**Shared export pipeline:**
- Purpose: Convert captured state into Markdown and optionally push it to the server.
- Location: `extension/shared/export.ts`, `extension/shared/server-export.ts`, `extension/utils/formatter.ts`, `extension/utils/filtered-data.ts`, `extension/utils/pruner.ts`, `extension/utils/clipboard.ts`
- Contains: Data filtering, redaction, pruning, Markdown formatting, clipboard write with fallback, and server push helpers.
- Depends on: `extension/browser-apis/`, `extension/types/`, `extension/utils/`
- Used by: Background runtime, panel actions, popup actions, FAB, and preview page.

**Server runtime:**
- Purpose: Receive Markdown exports over HTTP and expose the latest export through CLI and TUI flows.
- Location: `serve/src/server.ts`, `serve/src/cli.ts`, `serve/src/tui.ts`, `serve/src/clipboard.ts`, `serve/src/tailscale.ts`, `serve/scripts/bump-version.cjs`
- Contains: Fastify app factory, CLI argument parsing, TUI rendering, clipboard integration, Tailscale HTTPS detection, and version bump automation.
- Depends on: `fastify`, `@fastify/cors`, `clipboardy`, `update-notifier`, and the `tailscale` CLI for HTTPS mode.
- Used by: `loggy` CLI, browser extension server sync, direct API clients, and local automation.

**Release automation:**
- Purpose: Build, package, sign, and publish Firefox extension artifacts; manage AMO metadata and screenshots.
- Location: `extension/scripts/release.cjs`, `extension/scripts/bump-version.cjs`, `extension/scripts/prepare-source-zip.cjs`, `extension/scripts/fix-devtools-module.cjs`, `extension/scripts/rewrite-firefox-manifest.cjs`, `extension/scripts/sanitize-firefox-bundle.cjs`, `extension/scripts/fix-content-scripts.cjs`, `extension/scripts/update-amo-description.cjs`, `extension/scripts/upload-amo-screenshots.cjs`, `extension/scripts/screenshot-firefox.cjs`, `extension/scripts/amo-description.md`, `.github/workflows/release-extension.yml`, `.github/workflows/sign-extension.yml`, `.github/workflows/bump-version.yml`
- Contains: Release orchestration, Firefox bundle post-processing, AMO description updates, screenshot upload and diffing, Firefox-specific screenshot capture, and version bump automation.
- Depends on: `web-ext`, `dotenv-cli`, GitHub Actions, and Firefox build outputs.
- Used by: Firefox release, signing, AMO publishing, and versioning workflows.

**Workspace configuration:**
- Purpose: Define package boundaries, scripts, and shared project rules.
- Location: `package.json`, `extension/package.json`, `serve/package.json`, `extension/manifest.json`, `extension/manifest-chrome.json`, `extension/manifest-firefox.json`, `extension/vite.config.ts`, `extension/vitest.setup.ts`, `extension/scripts/`
- Contains: npm workspaces, build/test/lint scripts, package metadata, extension manifests, Vite bundler config, test setup with Chrome API mocks, and release helper scripts.
- Depends on: npm workspaces and Node.js 24+.
- Used by: Development commands and release pipelines.

## Data Flow

**Capture to export pipeline:**

1. Browser events enter the background service worker through runtime messages and capture callbacks — `extension/background/index.ts`
2. The background worker persists tab state, stores captured entries in session storage, and syncs consent/state to the extension UI — `extension/background/index.ts`, `extension/background/storage.ts`
3. The shared export pipeline filters, prunes, and formats console/network data into Markdown — `extension/shared/export.ts`, `extension/shared/server-export.ts`, `extension/utils/filtered-data.ts`, `extension/utils/pruner.ts`, `extension/utils/formatter.ts`
4. The panel, popup, FAB, and preview page render the current state, filters, and export actions from shared contexts and hooks — `extension/panel/src/main.tsx`, `extension/panel/src/LoggyContext.tsx`, `extension/popup/main.tsx`, `extension/popup/components/`, `extension/fab/FabContainer.tsx`, `extension/preview/preview.tsx`

**Server export pipeline:**

1. The panel probes the server endpoint by sending a `probe-server` message to the background worker, which performs the actual fetch to avoid CORS issues in Firefox DevTools — `extension/panel/server-probe.ts`, `extension/background/index.ts`
2. When auto-server-sync is enabled, the extension posts Markdown to `/loggy` — `extension/shared/export.ts`, `extension/shared/server-export.ts`
3. The server validates `text/plain`, updates in-memory state, and optionally writes to disk — `serve/src/server.ts`
4. The CLI exposes the latest export through `loggy print`, and the TUI exposes clipboard and status actions — `serve/src/cli.ts`, `serve/src/tui.ts`, `serve/src/clipboard.ts`
5. The server enables HTTPS with Tailscale certificates when available — `serve/src/tailscale.ts`, `serve/src/cli.ts`

## Key Abstractions

**`TabCaptureState`:**
- Purpose: Track capture mode, connection state, and per-tab log counts.
- Location: `extension/types/messages.ts`, `extension/types/responses.ts`, `extension/background/index.ts`
- Pattern: In-memory state synchronized to `chrome.storage.session`.

**`LoggyState`:**
- Purpose: Hold panel filters, captured data, export settings, and server sync flags.
- Location: `extension/types/state.ts`, `serve/src/server.ts`
- Pattern: Shared state object with workspace-specific variants.

**`BrowserAPI`:**
- Purpose: Abstract browser-specific API differences behind a build-time selection.
- Location: `extension/browser-apis/types.ts`, `extension/browser-apis/index.ts`, `extension/browser-apis/chrome.ts`, `extension/browser-apis/firefox.ts`
- Pattern: Interface plus platform-specific implementations.

**`CaptureMode`:**
- Purpose: Define the four capture modes (content-script, debugger, devtools, inactive).
- Location: `extension/types/capture.ts`
- Pattern: Union type used across background, panel, popup, and FAB layers.

**`CapturedConsoleEntry` / `CapturedNetworkEntry`:**
- Purpose: Represent console and network entries captured by the background pipeline.
- Location: `extension/types/capture.ts`
- Pattern: Interfaces with optional fields for headers, bodies, and timing.

**`CaptureControlMessage` / `CaptureStatusMessage`:**
- Purpose: Define typed control messages (probe, push, toggle, consent, status) and response payloads.
- Location: `extension/types/control.ts`, `extension/types/responses.ts`
- Pattern: Discriminated union interfaces with `type` field for message routing.

**`ExportData` / `formatMarkdown`:**
- Purpose: Represent captured page data and generate the final Markdown document.
- Location: `extension/utils/formatter.ts`
- Pattern: Pure transformation pipeline with helper formatters.

**`writeClipboard`:**
- Purpose: Write text to clipboard with async Clipboard API and hidden-textarea fallback.
- Location: `extension/utils/clipboard.ts`
- Pattern: Async function with failover strategy (navigator.clipboard → execCommand).

**`probeServer`:**
- Purpose: Check loggy-serve availability by delegating fetch to the background worker (avoids Firefox DevTools CORS issues).
- Location: `extension/panel/server-probe.ts`
- Pattern: Async function that sends `probe-server` runtime message and returns boolean.

**`FabState` / `FabActions`:**
- Purpose: Manage FAB UI state (active, logCount, modalOpen, isLogging, copyStatus) and expose actions (open/close modal, toggle logging, copy to clipboard).
- Location: `extension/fab/useFabState.ts`
- Pattern: React hook returning `{ state, actions }` with runtime message-based communication.

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
- Responsibilities: Route messages, manage capture modes, persist state, export Markdown, sync with the server, and handle server probes.

**Panel UI:**
- Location: `extension/panel/src/main.tsx`
- Triggers: DevTools panel load.
- Responsibilities: Mount the React app that drives capture controls and preview rendering.

**Popup UI:**
- Location: `extension/popup/main.tsx`, `extension/popup/Popup.tsx`
- Triggers: Browser action popup load.
- Responsibilities: Mount the popup React app and initialize popup interactions.

**FAB UI (Firefox Android):**
- Location: `extension/fab-ui.tsx`
- Triggers: Content script injection on Firefox Android (via `chrome.runtime.getPlatformInfo` check).
- Responsibilities: Mount the FAB React app inside a shadow DOM on the page, provide capture toggle and export actions.

**Preview page:**
- Location: `extension/preview/preview.tsx`
- Triggers: Popup "Preview" action opens a new tab/window with `preview.html?id=<cache-key>`.
- Responsibilities: Retrieve cached markdown via runtime message and render with rendered/raw toggle and copy button.

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

**Logging:** Use `console.error()` for CLI startup failures, `[Loggy:bg]`, `[Loggy:panel]`, and `[Loggy:popup]` prefixed logs for debug output in extension contexts.
**Caching:** Use in-memory maps for tab state and preview caching, plus `chrome.storage.session` for per-tab persistence and `chrome.storage.local` for settings.
**Storage:** Use `chrome.storage.session` and `chrome.storage.local` in the extension; use in-memory state and optional file writes in `serve/`.
**Clipboard:** Use `writeClipboard()` from `extension/utils/clipboard.ts` — async Clipboard API with hidden-textarea fallback — in panel, popup, FAB, and preview layers.
