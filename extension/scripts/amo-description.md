**Loggy** is a browser DevTools extension that turns Console and Network activity into clean, structured Markdown — compiled for token efficiency so you can debug faster with AI coding agents.

**Why Loggy?**

Debugging with AI usually means copying logs, formatting them, and stripping out noise before pasting into a chat. Loggy does that work for you — no need to even open the DevTools panel.

**Debug Android browsers without USB**

Loggy works on Firefox for Android. Pair it with `loggy-serve` running on your dev machine and you can capture mobile browser logs over the network — no ADB, no USB cable, no remote debugging setup. Just open the page on your phone, reproduce the bug, and the logs land on your desktop ready to paste into your AI chat.

**The AI Debugging Flow**

This is the workflow Loggy was built for:

1. **Describe the bug** to your AI coding agent (Claude Code, Cursor, etc.)
2. **Ask it to add strategic console logs** to help diagnose the issue
3. **Reproduce the bug** in your browser (desktop or Android)
4. **Copy Loggy's compiled output** and paste it back into the AI chat
5. **Let the AI fix it** with full context of exactly what happened

This loop is incredibly effective because the AI gets structured, filtered, token-efficient logs instead of raw noise.

**Features**

- **One-click capture** — Grab Console logs and Network requests from the current page instantly
- **Android support** — Capture logs from Firefox for Android via `loggy-serve` — no USB debugging required
- **Smart filtering** — Regex-based console filters plus include/exclude patterns for network requests (prefix with `-` to exclude, e.g. `api.v1 -*.png`)
- **Automatic pruning** — Removes binary payloads, base64 blobs, and oversized responses so the output stays readable and token-efficient
- **Structured Markdown output** — Clean tables with timestamps, log levels, request details, and response summaries
- **Copy to clipboard** — Export everything in one click, ready to paste
- **Server export** — Sync logs to your own `loggy-serve` instance for cross-device and mobile workflows

**How to use (desktop)**

1. Open DevTools (`F12`) on any page
2. Click the **Loggy** tab
3. Apply filters if you want to narrow the output
4. Click **Copy to Clipboard**
5. Paste into your AI coding agent chat

**How to use (Android)**

1. Start `loggy-serve` on your dev machine:
   `npx loggy-serve --port 8743`
2. On your Android device, open Firefox and navigate to the page you want to debug
3. Open Loggy from the browser menu and point it to your server (e.g. `http://192.168.1.100:8743`)
4. Reproduce the issue, then export — logs land on your dev machine instantly
5. Use `loggy print` or check `http://localhost:8743/loggy/export` to grab the output

**Using with loggy-serve**

`npm install -g loggy-serve`

or

`npx loggy-serve --port 8743`

**npm package:** [loggy-serve](https://www.npmjs.com/package/loggy-serve)

**Privacy**

Loggy runs locally in your browser by default:

- No data sent to external servers
- No analytics or tracking
- Clipboard access only triggered by your explicit action
- Optional server export only runs when you connect it to your own `loggy-serve` instance
