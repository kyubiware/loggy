**Loggy** — Capture and export Console & Network logs for LLM debugging

## Summary (250 char limit)

DevTools extension that captures, filters, and exports Console & Network logs as structured Markdown — ready to paste into any LLM debugging workflow.

---

## Description

**Loggy** is a browser DevTools extension that turns Console and Network activity into clean, structured Markdown for faster debugging.

### Why Loggy?

Debugging with AI usually means copying logs, formatting them, and stripping out noise before pasting into a chat. Loggy does that work for you.

### Features

- **One-click capture** — Grab Console logs and Network requests from the current page instantly
- **Smart filtering** — Regex-based console filters plus include/exclude patterns for network requests (prefix with `-` to exclude, e.g. `api.v1 -*.png`)
- **Automatic pruning** — Removes binary payloads, base64 blobs, and oversized responses so the output stays readable
- **Structured Markdown output** — Clean tables with timestamps, log levels, request details, and response summaries
- **Copy to clipboard** — Export everything in one click, ready to paste
- **Optional server export** — Sync logs to your own `loggy-serve` instance when you want a shareable endpoint

### How to use

1. Open DevTools (`F12`) on any page
2. Click the **Loggy** tab
3. Apply filters if you want to narrow the output
4. Click **Copy to Clipboard**
5. Paste into your LLM chat

### Privacy

Loggy runs locally in your browser by default:
- No data sent to external servers
- No analytics or tracking
- Clipboard access only triggered by your explicit action
- Optional server export only runs when you connect it to your own `loggy-serve` instance
