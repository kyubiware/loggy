# LOGGY PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-31

## OVERVIEW
Monorepo with npm workspaces containing a Chrome/Firefox DevTools extension and a companion Fastify server for markdown log exports.

## STRUCTURE
```
./
├── extension/      # Browser extension (TypeScript + React + Manifest V3)
│   ├── panel/     # DevTools panel UI
│   ├── utils/     # Data processing utilities
│   ├── types/     # TypeScript definitions
│   ├── browser-apis/  # Cross-browser abstractions
│   └── manifest.json  # Manifest V3 config
├── serve/         # Fastify companion server
│   ├── src/       # Server implementation
│   └── bin/       # CLI entry point
└── package.json   # Workspace root
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Extension code | extension/ | See extension/AGENTS.md |
| Server code | serve/ | Fastify API for log exports |
| Workspace config | package.json | Workspaces: ["extension", "serve"] |

## COMMANDS

```bash
# Build extension only
npm run build

# Run all tests
npm test

# Lint extension
npm run lint
```

## NOTES

- Uses npm workspaces (not pnpm/yarn)
- Extension is the primary workspace with most tooling
- Server has minimal config (test + typecheck only)
- No root-level build/test/lint configs
