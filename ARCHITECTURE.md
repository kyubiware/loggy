# Architecture

## Pattern Overview

**Overall:** Workspace-based browser extension plus companion HTTP server

**Key Characteristics:**
- Use `extension/` for capture, filtering, formatting, and UI.
- Use `serve/` for HTTP ingestion, CLI control, and optional TUI status.

## Layers

**Extension runtime:**
- Purpose: Capture console and network data from browser tabs and export Markdown.
- Location: `extension/background/index.ts`, `extension/capture/`, `extension/panel/src/`, `extension/popup/`, `extension/utils/`, `extension/shared/`
- Contains: Background service worker, capture bridge, React panel UI, popup UI, Markdown formatting, filtering, pruning, and browser API adapters.
- Depends on: `chrome.*`/`browser.*` APIs, `extension/types/`, `extension/utils/`, `extension/shared/`
- Used by: DevTools panel, popup, content scripts, and background event handlers.

**Server runtime:**
- Purpose: Receive pasted exports over HTTP and provide CLI/TUI access to the latest export.
- Location: `serve/src/server.ts`, `serve/src/cli.ts`, `serve/src/tui.ts`, `serve/src/clipboard.ts`
- Contains: Fastify app factory, CLI argument parsing, TUI rendering, clipboard integration.
- Depends on: `fastify`, `@fastify/cors`, `clipboardy`, `update-notifier`
- Used by: `loggy` CLI, browser extension server sync, and direct API clients.

**Workspace configuration:**
- Purpose: Define package boundaries, scripts, and shared project rules.
- Location: `package.json`, `extension/package.json`, `serve/package.json`
- Contains: npm workspaces, build/test/lint scripts, package metadata.
- Depends on: Workspace package managers and Node.js 24+.
- Used by: Development commands and release pipelines.

## Data Flow

**Capture to export pipeline:**

1. Browser events enter the background service worker through runtime messages — `extension/background/index.ts`
2. The background worker persists tab state, stores captured entries, and builds Markdown — `extension/background/index.ts`
3. The formatter converts console and network data into structured Markdown — `extension/utils/formatter.ts`
4. The panel renders filtered state and preview content from the captured data — `extension/panel/src/main.tsx`

**Server export pipeline:**

1. The extension posts Markdown to the local server endpoint — `extension/background/index.ts`
2. The server validates `text/plain`, updates in-memory state, and optionally writes to disk — `serve/src/server.ts`
3. The CLI exposes the latest export through `loggy print` and the TUI clipboard shortcut — `serve/src/cli.ts`, `serve/src/tui.ts`

## Key Abstractions

**`TabCaptureState`:**
- Purpose: Track capture mode, connection state, and per-tab log counts.
- Location: `extension/background/index.ts`, `extension/types/messages.ts`
- Pattern: In-memory state synchronized to `chrome.storage.session`.

**`LoggyState`:**
- Purpose: Track export count, last export metadata, and the latest export payload in the server.
- Location: `serve/src/server.ts`
- Pattern: Fastify instance decoration plus event emitter updates.

**`ExportData` / `formatMarkdown`:**
- Purpose: Represent the captured page and generate the final Markdown document.
- Location: `extension/utils/formatter.ts`
- Pattern: Pure transformation pipeline with helper formatters.

**`createServer()` / `startServer()`:**
- Purpose: Build and launch the Fastify API with CORS and export endpoints.
- Location: `serve/src/server.ts`
- Pattern: Factory plus start wrapper with explicit error handling.

## Entry Points

**Background service worker:**
- Location: `extension/background/index.ts`
- Triggers: Extension install/startup, tab events, runtime messages, and capture messages.
- Responsibilities: Route messages, manage capture modes, persist state, export Markdown, and sync with the server.

**Panel UI:**
- Location: `extension/panel/src/main.tsx`
- Triggers: DevTools panel load.
- Responsibilities: Mount the React app that drives capture controls and preview rendering.

**Server CLI:**
- Location: `serve/src/cli.ts`
- Triggers: `loggy`, `loggy print`, `--version`, and process signals.
- Responsibilities: Parse flags, start the server, render the TUI, and print the latest export.

## Error Handling

**Strategy:** Use explicit validation, guarded async operations, and fail-closed defaults.

## Cross-Cutting Concerns

**Logging:** Use `console.error()` for startup and capture failures, and show transient TUI messages for user feedback.
**Caching:** Use in-memory maps for tab state and preview caching, plus `chrome.storage.session` for per-tab persistence.
**Storage:** Use `chrome.storage.session` and `chrome.storage.local` in the extension; use in-memory state and optional file writes in `serve/`.
