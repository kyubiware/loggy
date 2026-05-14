# SERVE KNOWLEDGE BASE

**Generated:** 2026-05-13
**Commit:** d96265d
**Branch:** main

**Scope:** Fastify companion server

## OVERVIEW
Fastify server providing HTTP endpoints for receiving and retrieving Loggy markdown exports. Features interactive TUI mode (readline raw-mode) for live status and clipboard integration. CLI-ready with configurable port and output path.

## STRUCTURE
```
serve/
├── src/
│   ├── server.ts       # Fastify app factory + start function
│   ├── tui.ts          # Interactive terminal UI (readline raw-mode)
│   ├── clipboard.ts    # Cross-platform clipboard integration
│   ├── tailscale.ts    # Tailscale HTTPS cert detection
│   └── cli.ts          # CLI entry point (arg parsing, TUI launch)
├── tests/
│   └── server.test.ts  # Vitest tests
├── bin/
│   └── loggy-serve.js  # CLI entry point
├── scripts/
│   └── bump-version.cjs # Version bump automation
├── package.json        # Fastify deps + Vitest
└── tsconfig.json       # TypeScript config
```
## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Server factory | src/server.ts | createServer() with CORS + routes |
| Start server | src/server.ts | startServer() with port/host options |
| POST endpoint | src/server.ts | /loggy - receive markdown export |
| GET export | src/server.ts | /loggy/export - retrieve latest |
| Handshake | src/server.ts | /loggy/handshake - version check |
| TUI logic | src/tui.ts | Interactive status bar and shortcuts (readline raw-mode) |
| Clipboard | src/clipboard.ts | Cross-platform copy integration |
| Tailscale HTTPS | src/tailscale.ts | Auto-detect + provision TLS certs |
| CLI entry | src/cli.ts | Arg parsing, TUI launch, `print` subcommand |
| Error formatting | src/server.ts | formatStartupError() for EADDRINUSE |

## CONVENTIONS

- **Interactive TUI**: On by default in TTY; --quiet for plain logs
- **TUI Comms**: Server decorates Fastify with EventEmitter for UI updates
- **ES modules**: `"type": "module"` in package.json
- **Factory pattern**: createServer() returns configured Fastify instance
- **CORS**: Wildcard origin allowed (`*`) for local dev
- **Body limit**: 52MB (52_428_800 bytes) for large log exports
- **File writes**: Async writeFile with UTF-8 encoding
- **Error handling**: try/catch in async startServer(), typed error codes

## ANTI-PATTERNS

- NEVER block the event loop - use async file operations
- NEVER hardcode ports - accept via options with defaults (8743)
- NEVER skip error handling for listen() - always catch and format
- NEVER use sync file writes in request handlers

## NOTES

- TUI shortcuts: `c` to copy latest export, `q` to quit
- Server decorates Fastify instance with custom state + EventEmitter
- Default port: 8743, default host: 127.0.0.1
- Body must be text/plain string (validated in POST handler)
- Stores latest export in memory (latestExport variable)
- Optional file write via outputPath option
- EADDRINUSE errors formatted with helpful CLI message
- No persistent storage - memory-only between restarts
- CORS enabled for local development only
