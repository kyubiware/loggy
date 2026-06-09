<div align="center">
  <img src="loggy_icon.png" width="128" alt="Loggy Icon">

  # Loggy

  [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/gaefhhegebljimfnjjbbikhddkpilpaf)](https://chromewebstore.google.com/detail/loggy/gaefhhegebljimfnjjbbikhddkpilpaf)
  [![Firefox Add-ons](https://img.shields.io/amo/v/5dcdd43f5fa642e69f21)](https://addons.mozilla.org/en-US/firefox/addon/5dcdd43f5fa642e69f21/)
  [![npm](https://img.shields.io/npm/v/loggy-serve)](https://www.npmjs.com/package/loggy-serve)

  AI agents write your code. They need the logs to fix bugs on the first try. Loggy captures every console message and network request in one click. No more dragging, selecting, and reformatting by hand. Your agent gets the full context and finds what it needs.

</div>

---

![Loggy Panel Overview](screenshots/panel-expanded.png)

## Features

- **One-click capture**: Instantly collect console logs and network requests from the current tab.
- **Regex filtering**: Use regular expressions to filter console messages (e.g. `error|warn`).
- **Targeted network capture**: Include or exclude specific routes using string patterns.
- **Automatic pruning**: Automatically removes binary data, base64 blobs, and oversized payloads to keep exports clean.
- **Smart consolidation**: Groups related logs by signal ranking and failure patterns to highlight what matters.
- **Markdown export**: Generates structured Markdown ready for clipboard or HTTP export.
- **Firefox Android support**: Includes a dedicated Floating Action Button (FAB) UI for mobile debugging.
- **Cross-browser compatibility**: Native support for both Chrome and Firefox.

## How It Works

Loggy uses a specialized capture pipeline to ensure your logs are useful and concise.

1. **Capture**: Uses the Debugger API (Chrome) or DevTools APIs (Firefox) to intercept console and network events.
2. **Filter**: Applies your regex and path filters to discard irrelevant noise.
3. **Prune**: Identifies and strips heavy payloads like images, fonts, or large JSON blobs.
4. **Consolidate**: Analyzes logs to group repeating patterns or related network/console errors.
5. **Export**: Formats the resulting data into GFM-compliant Markdown.

## Installation

### Chrome

1. Clone the repository:
   ```bash
   git clone https://github.com/kyubiware/loggy && cd loggy
   ```
2. Install dependencies and build:
   ```bash
   npm install && npm run build
   ```
3. Open `chrome://extensions/` and enable **Developer mode**.
4. Click **Load unpacked** and select the `dist-chrome` directory.
5. Open DevTools (F12) and find the **Loggy** tab.

### Firefox

Install directly from [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/5dcdd43f5fa642e69f21/).

To build from source:
```bash
npm run package:firefox
```
Load the `loggy-firefox.xpi` as a temporary add-on via `about:debugging`.

## Usage

1. Open DevTools (F12) and click the **Loggy** tab.
2. Configure your filters:
   - **Console filter**: A regex pattern for messages.
   - **Network filter**: Path patterns (use `-` to exclude, e.g. `api -*.png`).
3. Click **Refresh** to capture current data.
4. Review the preview and click **Copy to Clipboard**.

![Markdown Preview](screenshots/panel-preview.png)

## Companion Server

The `serve` package provides a Fastify server to receive exports over HTTP. This is useful for automated logging or when you want to pipe browser logs into a file or another tool.

```bash
npx loggy-serve --port 8743
```

> [!TIP]
> Use the `--quiet` flag to disable the TUI and output plain logs to the terminal.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/loggy` | Submit a markdown export (text/plain) |
| `GET` | `/loggy/export` | Retrieve the latest export |
| `GET` | `/loggy/handshake` | Server version information |

## Output Example

The exported Markdown is structured for clarity and readability:

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
| 10:30:05 | error | Failed to load resource: the server responded with a status of 404 |

### Network Activity
...
```

## Development

| Task | Command |
|------|---------|
| Install dependencies | `npm install` |
| Build extension | `npm run build` |
| Dev server (Chrome HMR) | `npm run dev` |
| Run all tests | `npm test` |
| Lint & Format | `npm run lint && npm run format` |

### Requirements

| Program | Version | Source |
|---------|---------|--------|
| **Node.js** | 24+ | [nodejs.org](https://nodejs.org) |
| **npm** | Latest | Included with Node |
| **zip** | Recent | OS Package Manager |

## Privacy

Loggy runs entirely locally. No data leaves your machine unless you explicitly use the Companion Server. There are no analytics, tracking, or external dependencies. Clipboard access is only triggered by your direct action.

## Links

- [Chrome Web Store](https://chromewebstore.google.com/detail/loggy/gaefhhegebljimfnjjbbikhddkpilpaf)
- [Firefox Add-on](https://addons.mozilla.org/en-US/firefox/addon/5dcdd43f5fa642e69f21/)
- [npm (loggy-serve)](https://www.npmjs.com/package/loggy-serve)
