# TYPES KNOWLEDGE BASE

**Scope:** Type definitions for Loggy

## OVERVIEW
TypeScript type definitions for console messages, HAR (HTTP Archive) network entries, state persistence, and extension message passing.

## STRUCTURE
types/
├── console.ts          # ConsoleMessage interface, LogLevel enum
├── har.ts              # HAREntry, Request, Response, Timings
├── capture.ts          # CapturedConsoleEntry, CapturedNetworkEntry, CaptureMode union
├── control.ts          # CaptureControlMessage, ConsentState, ConsentResponseMessage
├── responses.ts        # CaptureStatusMessage + response shape unions
├── state.ts            # LoggyState, PersistedLoggySettings, persistence helpers
├── state.test.ts       # State persistence tests
├── messages.ts         # LoggyMessage union type (all extension messages)
└── js-modules.d.ts     # JavaScript module declarations / global augmentations

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Console log types | console.ts | ConsoleMessage interface |
| Console levels | console.ts | LogLevel enum (log/info/warn/error/debug) |
| HAR entry types | har.ts | HAREntry, Request, Response |
| Network timing | har.ts | Timings interface |
| Capture mode | capture.ts | CaptureMode union: 'debugger' \| 'content-script' \| 'devtools' \| 'inactive' |
| Captured entries | capture.ts | CapturedConsoleEntry, CapturedNetworkEntry (background-side shape) |
| Control messages | control.ts | CaptureControlMessage discriminated union + consent types |
| Response shapes | responses.ts | CaptureStatusMessage, ConsentResponseMessage, etc. |
| Panel state | state.ts | LoggyState, PersistedLoggySettings |
| State helpers | state.ts | createInitialState, extractPersistedSettings, mergePersistedSettings |
| Extension messages | messages.ts | LoggyMessage union = CaptureMessage \| CaptureControlMessage \| LoggyRelayMessage |
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
- LoggyState: panel state shape for capture/filter/export flow
- Persisted settings: createInitialState, extractPersistedSettings, mergePersistedSettings
- js-modules.d.ts: global augmentations for Chrome APIs
