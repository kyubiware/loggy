# Loggy

A Chrome DevTools extension for capturing, filtering, and exporting Console & Network logs in a format optimized for LLM debugging workflows.

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

- Node.js 18+
- Chrome browser

### Setup

```bash
npm install
```

### Build

```bash
npx tsc
```

### Load in Chrome

Follow installation steps above, pointing to the project directory.

## Privacy

Loggy operates entirely locally:
- No data sent to external servers
- No analytics or tracking
- Clipboard access only on explicit user action

## License

MIT
