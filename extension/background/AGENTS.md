# BACKGROUND SERVICE WORKER

## OVERVIEW
Central coordinator for state management, capture orchestration, and server export. Manifest V3 service worker (transient).

## STRUCTURE
- `index.ts`: Entry point. 700+ lines managing state, storage, and message routing.

## WHERE TO LOOK
| Task | Location |
|------|----------|
| State Management | `activeTabs` (Map), `captureState` (Map) |
| Message Router | `chrome.runtime.onMessage.addListener` |
| Capture Logic | `startCapture`, `stopCapture` (Debugger vs Content vs DevTools) |
| Server Export | `exportToServe` function (POST markdown) |
| Lifecycle | `chrome.tabs.onRemoved`, `chrome.webNavigation.onBeforeNavigate` |

## CONVENTIONS
- Use `chrome.storage.local` for persistence across worker restarts.
- Memory state (Maps) must sync with storage on change.
- All incoming messages use `LoggyMessage` type.
- Capture mode selection happens here before delegating to `capture/` modules.

## ANTI-PATTERNS
- **NO window/DOM access**: Use content scripts or offscreen documents if needed.
- **NO long-running listeners**: Worker can sleep. State must be resumable.
- **NO direct debugger calls**: Route through `capture/debugger-capture.ts`.

## NOTES
- `debugger` mode requires `chrome.debugger` permission and is Chrome-only.
- `content-script` mode relies on `MAIN` world execution (patched globals).
- `devtools` mode expects the panel to be open; background stays in standby.
- Tab cleanup is critical to prevent memory leaks in the `activeTabs` Map.
- Coordinates with `content-relay.ts` for bridging page events to the extension.
