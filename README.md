# Loggy

A Chrome/Firefox DevTools extension that captures Console & Network logs and exports them as structured Markdown — optimized for pasting into LLM debugging workflows.

## What It Does

Loggy adds a tab to Chrome DevTools that lets you capture, filter, and export browser logs in one click. The output is clean Markdown, ready to paste into any LLM chat.

- **One-click capture** of console logs and network requests
- **Regex filtering** for console messages, string-based include/exclude for network requests
- **Automatic pruning** of binary data, base64 blobs, and oversized payloads
- **Smart consolidation** that groups related logs by signal ranking and failure patterns
- **Markdown export** copied directly to clipboard

## Companion Server

The `serve` workspace provides an optional Fastify server for receiving exports over HTTP instead of the clipboard. Useful for piping logs into automated workflows.

```bash
# From the repo root
npx loggy-serve --port 8743
```

Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/loggy` | Submit a markdown export (text/plain) |
| `GET` | `/loggy/export` | Retrieve the latest export |
| `GET` | `/loggy/handshake` | Server version info |

## Links

- **Firefox Add-on**: [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/5dcdd43f5fa642e69f21/)
- **npm (loggy-serve)**: [npmjs.com](https://www.npmjs.com/package/loggy-serve)

## Installation

### Chrome

1. Clone the repo and install dependencies:
   ```bash
   git clone <repo-url> loggy && cd loggy && npm install
   ```
2. Build the extension:
   ```bash
   npm run build
   ```
3. Open `chrome://extensions/` and enable **Developer mode**
4. Click **Load unpacked** and select the `dist-chrome` directory
5. Open DevTools (F12) on any page — look for the **Loggy** tab

### Firefox

Install from [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/5dcdd43f5fa642e69f21/).

To build from source:

```bash
npm run package:firefox
```

Load the resulting `loggy-firefox.xpi` as a temporary add-on via `about:debugging`.

## Usage

1. Open DevTools (F12) and click the **Loggy** tab
2. Optionally set filters:
   - **Console filter** — regex pattern (e.g. `error|warn`)
   - **Network filter** — include/exclude patterns (`-` prefix to exclude, e.g. `api -*.png`)
3. Click **Refresh** to capture current data
4. Review the preview, then click **Copy to Clipboard**

## Output Format

Exports are structured Markdown:

```markdown
## Debug Log Export

### Environment
- **URL**: https://example.com
- **Time**: 2024-01-15T10:30:00Z
- **Console Logs**: 5
- **Network Requests**: 12

### Console Logs
| Timestamp | Level | Message |
|-----------|-------|---------|
| ... | error | Something went wrong |

### Network Activity
...
```

## Development

```bash
npm install           # Install all workspace dependencies
npm run build         # Build extension (Chrome + Firefox)
npm run dev           # Vite dev server (Chrome mode)
npm test              # Run tests across all workspaces
npm run lint          # Biome lint (extension workspace)
npm run lint:fix      # Auto-fix lint issues
npm run format        # Format with Biome
```

### Requirements

| Program | Version | How to Install |
|---------|---------|----------------|
| **Node.js** | 24 or later | [nodejs.org](https://nodejs.org) or [nvm](https://github.com/nvm-sh/nvm) |
| **npm** | Included with Node.js | Installed automatically |
| **zip** | Any recent version | Linux: `sudo apt install zip` · macOS: pre-installed · Windows: [7-Zip](https://7-zip.org) or WSL |

All other build dependencies (Vite, TypeScript, React, Tailwind CSS, Biome, etc.) are installed automatically via `npm install`.

**Supported operating systems:** Linux, macOS, Windows (WSL recommended for packaging).

## Privacy

Loggy runs entirely locally. No data leaves your machine — no analytics, no external servers, no tracking. Clipboard access only happens on explicit user action.

## License

[MIT](LICENSE) © Kyubiware
