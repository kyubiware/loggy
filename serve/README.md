[← Back to Loggy](../README.md)

# loggy-serve

Fastify companion server for Loggy markdown exports.

## Overview

`loggy-serve` is an optional companion server that receives Loggy markdown exports over HTTP. It provides an alternative to the system clipboard, making it easier to pipe browser logs directly into local files or automated development workflows.

## Links

- **npm**: [npmjs.com/package/loggy-serve](https://www.npmjs.com/package/loggy-serve)
- **Firefox Add-on**: [addons.mozilla.org](https://addons.mozilla.org/en-US/firefox/addon/5dcdd43f5fa642e69f21/)

## Install

Install globally or as a dependency:

```bash
npm install -g loggy-serve
```

Or run via `npx`:

```bash
npx loggy-serve
```

## CLI Usage

Start the server using the `loggy` command:

```bash
loggy [flags]
```

### Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--port <number>` | Port to listen on | `8743` |
| `--output <path>` | Write every received export to this file | - |
| `--quiet`, `--no-interactive` | Disable TUI and print plain logs | - |
| `--https` | Force HTTPS with Tailscale certificates | Auto-detect |
| `--no-https` | Disable HTTPS even if Tailscale is available | - |

## Interactive TUI

When running in a TTY without the `--quiet` flag, `loggy-serve` displays a live status bar showing:
- Active port and host
- Total export count
- Timestamp and size of the latest export

### Keyboard Shortcuts
- `c`: Copy the latest export to your system clipboard
- `q`: Shut down the server

## API Endpoints

The server listens on `0.0.0.0` (all interfaces) by default, making it accessible from other devices on your local network. When [Tailscale](https://tailscale.com) is running and HTTPS certificates are enabled for your tailnet, the server automatically provisions a TLS certificate and starts in HTTPS mode. CORS is enabled for all origins (`*`) and the request body limit is 52MB. All data is stored in memory and resets when the server restarts.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/loggy` | Submit markdown export (Body: `text/plain`) |
| `GET` | `/loggy/export` | Retrieve the latest export as `text/plain` |
| `GET` | `/loggy/handshake` | Returns `{ version, name }` |

### Examples

**Submit an export:**
```bash
curl -X POST http://127.0.0.1:8743/loggy \
  -H "Content-Type: text/plain" \
  -d "# My Debug Log"
```

**Retrieve latest export:**
```bash
curl http://127.0.0.1:8743/loggy/export
```

## Tailscale HTTPS

When Tailscale is running on your machine and [HTTPS certificates are enabled](https://login.tailscale.com/admin/dns) for your tailnet, `loggy-serve` automatically:

1. Detects the Tailscale hostname (e.g. `my-machine.tail1234.ts.net`)
2. Provisions a TLS certificate via `tailscale cert`
3. Starts an HTTPS server on the Tailscale domain

This allows the Loggy browser extension to export logs securely over HTTPS — required by Firefox's HTTPS-Only Mode and increasingly by Chrome.

### Setup

1. Install and run [Tailscale](https://tailscale.com)
2. Enable HTTPS certificates at [login.tailscale.com/admin/dns](https://login.tailscale.com/admin/dns)
3. Start `loggy` — it will automatically detect Tailscale and use HTTPS
4. In the browser extension, set the server URL to `https://your-machine.tail1234.ts.net:8743`

### Flags

- `--https` — Force HTTPS. Errors if Tailscale is not available.
- `--no-https` — Disable HTTPS. Always uses HTTP regardless of Tailscale status.

If neither flag is passed, the server auto-detects Tailscale and falls back to HTTP if unavailable.

## Programmatic Usage

You can integrate the server into your own Node.js tools using the exported factory functions.

```typescript
import { createServer, startServer } from 'loggy-serve'

// 1. Create instance without starting
const app = createServer({ 
  outputPath: './logs/latest.md' 
})

// 2. Start server directly
const server = await startServer({
  port: 8743,
  outputPath: './debug.md'
})
```

### Types

```typescript
interface ServerOptions {
  outputPath?: string
  https?: { key: Buffer; cert: Buffer }
}

interface StartServerOptions extends ServerOptions {
  port?: number
  host?: string
}
```

## Development

```bash
npm run build       # Compile TypeScript to dist/
npm run dev         # Start server with tsx (watch mode)
npm run start       # Run the compiled CLI
npm test            # Run Vitest suite
npm run typecheck   # Run tsc --noEmit
```

The `package.json` also includes helper scripts for testing endpoints:
```bash
npm run curl:post
npm run curl:export
npm run curl:handshake
```

## License

[MIT](LICENSE) © Kyubiware

