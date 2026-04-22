# TYPES KNOWLEDGE BASE

**Scope:** Type definitions for Loggy

## OVERVIEW
TypeScript type definitions for console messages, HAR (HTTP Archive) network entries, and extension message passing.

## STRUCTURE
types/
├── console.ts          # ConsoleMessage interface
├── har.ts              # HAREntry and related types
├── messages.ts         # LoggyMessage union type for extension message passing
└── js-modules.d.ts     # JavaScript module declarations

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Console log types | console.ts | ConsoleMessage interface |
| Console levels | console.ts | LogLevel enum |
| HAR entry types | har.ts | HAREntry, Request, Response |
| Network timing | har.ts | Timings interface |
| Extension messages | messages.ts | LoggyMessage union type (all inter-component messages) |
| Module declarations | js-modules.d.ts | global type augmentations |

## CONVENTIONS

- **Interfaces**: Use interface for object shapes
- **Enums**: Use for finite value sets (LogLevel)
- **Exports**: export type/interface for public types
- **JSDoc**: Document exported types

## ANTI-PATTERNS

- NEVER use any - define proper types
- NEVER export unused types
- NEVER omit optional properties - use ? modifier
- NEVER use type when interface suffices

## NOTES

- LoggyMessage: Central type for background ↔ panel/popup communication
- ConsoleMessage: timestamp, level, message, args
- LogLevel: log, info, warn, error, debug
- HAREntry: request, response, timings, status
- js-modules.d.ts: global augmentations for Chrome APIs
