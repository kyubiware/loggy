# Loggy

A Chrome/Firefox DevTools extension for capturing, filtering, and exporting Console & Network logs in a format optimized for LLM debugging workflows.

**Install on Firefox**: [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/5dcdd43f5fa642e69f21/)

## Features

- **Unified Capture**: One-click retrieval of Console logs and Network HAR data
- **Dynamic Filtering**: Regex-based console filtering, string-based network filtering with include/exclude patterns
- **Data Pruning**: Automatic removal of binary data, base64, and large blobs
- **Smart Export**: Formatted Markdown output copied directly to clipboard

## Installation

### Developer Mode (Local Installation)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked"
5. Select the `loggy` directory
6. Open DevTools (F12) on any webpage → Look for "Loggy" tab

## Usage

1. Open Chrome DevTools (F12) on any webpage
2. Click the "Loggy" tab
3. Use filters to narrow down logs:
   - **Console Filter**: Enter regex pattern (e.g., `error|warn`)
   - **Network Filter**: Enter patterns, use `-` prefix to exclude (e.g., `api.v1 -*.png`)
4. Click "Refresh" to capture current data
5. Review the preview
6. Click "Copy to Clipboard" to export

## Output Format

The extension generates structured Markdown:

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

### Prerequisites

| Program | Version | How to Install |
|---------|---------|----------------|
| **Node.js** | 24 or later | Download from [nodejs.org](https://nodejs.org) or use a version manager like [nvm](https://github.com/nvm-sh/nvm) |
| **npm** | Included with Node.js | Installed automatically with Node.js |
| **zip** | Any recent version | Linux: `sudo apt install zip` · macOS: pre-installed · Windows: use [7-Zip](https://7-zip.org) or WSL |

All other build dependencies (Vite, TypeScript, React, Tailwind CSS, Biome, etc.) are installed automatically via `npm ci` in the steps below — no separate installation needed.

**Supported operating systems:** Linux, macOS, Windows (with WSL recommended for the packaging step).

### Setup

```bash
npm install
```

### Build from Source

These steps produce an exact copy of the Firefox add-on from source code.

1. Open a terminal in the `extension/` directory.
2. Install dependencies (use `--ignore-scripts` to skip git hooks):
   ```bash
   npm ci --ignore-scripts
   ```
3. Run the build script:
   ```bash
   npm run build:firefox
   ```
   This runs `vite build --mode firefox`, then copies the manifest and icons, rewrites content script paths, and sanitizes the bundle.

4. Verify the output:
   ```bash
   ls dist-firefox/manifest.json
   ```

5. Package as `.xpi`:
   ```bash
   npm run package:firefox
   ```
   Produces `loggy-firefox.xpi` in the current directory.

### Sign & Publish to AMO

To get a signed XPI for distribution via addons.mozilla.org:

1. Create API credentials at [addons.mozilla.org/developers/addon/api/key/](https://addons.mozilla.org/developers/addon/api/key/).
2. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
3. Build and sign:
   ```bash
   npm run sign:firefox
   ```
   The signed XPI is downloaded to the current directory.

4. Optionally, lint your build before signing:
   ```bash
   npm run lint:firefox
   ```

### Load in Chrome

Follow the installation steps above, pointing to the project directory.

## Privacy

Loggy operates entirely locally:
- No data sent to external servers
- No analytics or tracking
- Clipboard access only on explicit user action

## License

MIT
