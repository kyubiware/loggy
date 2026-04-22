**Loggy** — Capture and export Console & Network logs for LLM debugging

## Summary (250 char limit)

DevTools extension that captures, filters, and exports Console & Network logs as structured Markdown — optimized for pasting into ChatGPT, Claude, and other LLM debugging workflows.

---

## Description

**Loggy** is a browser DevTools extension that turns your Console and Network activity into clean, structured Markdown — ready to paste directly into any LLM for debugging help.

### Why Loggy?

Debugging with AI usually means manually copying logs, formatting them, and stripping out noise before pasting into a chat. Loggy does all of that in one click.

### Features

- **One-click capture** — Grab all Console logs and Network requests from the current page instantly
- **Smart filtering** — Regex-based console filtering; include/exclude patterns for network requests (prefix with `-` to exclude, e.g. `api.v1 -*.png`)
- **Automatic data pruning** — Strips binary payloads, base64 blobs, and oversized responses so your LLM gets the signal, not the noise
- **Structured Markdown output** — Clean tables with timestamps, log levels, request details, and response summaries
- **Copy to clipboard** — One button to export everything, ready to paste

### How to use

1. Open DevTools (`F12`) on any page
2. Click the **Loggy** tab
3. Apply filters to narrow down what you need
4. Click **Copy to Clipboard**
5. Paste into your LLM chat

### Privacy

Loggy runs entirely in your browser:
- No data sent to external servers
- No analytics or tracking
- Clipboard access only triggered by your explicit action
