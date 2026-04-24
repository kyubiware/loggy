# PANEL KNOWLEDGE BASE

**Scope:** DevTools Panel UI

## OVERVIEW
Main DevTools panel UI. React handles all UI; root TypeScript files are DevTools-specific business logic for capture, preview, and server checks.

## STRUCTURE
```
panel/
├── src/                    # React application
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Main React component
│   ├── index.css          # Styles
│   ├── components/        # React UI components
│   │   ├── Controls.tsx   # Filter inputs and buttons
│   │   ├── PreviewPane.tsx  # Data preview display
│   │   ├── ActionsAndToast.test.tsx  # Component tests
│   │   └── Toast.tsx     # Toast notification component
│   └── hooks/            # React hooks
│       ├── useCaptureData.ts   # Data capture logic
│       └── useToast.ts         # Toast state management
├── capture.ts             # Console & network capture
├── preview.ts             # Preview rendering (non-React)
├── server-probe.ts        # Server availability probe
└── actions.ts             # Action handlers
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| React entry point | src/main.tsx | Mounts React app |
| Main React component | src/App.tsx | App orchestration |
| Filter controls | src/components/controls/ | Input handlers |
| Preview display | src/components/PreviewPane.tsx | Data rendering |
| Toast component | src/components/Toast.tsx | Notification UI |
| Data capture hook | src/hooks/useCaptureData.ts | React hook for console/network |
| Toast hook | src/hooks/useToast.ts | Toast state management |
| State interface | ../types/state.ts | LoggyState with visibility flags |
| Console capture | capture.ts | Script injection, circular buffer |
| Network capture | capture.ts | getHAR() API wrapper |
| Filtered data | ../utils/filtered-data.ts | FilteredPanelData interface |
| Debounce utility | ../utils/debounce.ts | Generic TypeScript debounce |
| Preview rendering | preview.ts | DOM updates for filtered data |
| Clipboard export | ../shared/export.ts | formatMarkdown + clipboard API & server export |
| Server export | ../shared/server-export.ts | pushToServer helper |
| Server probe | server-probe.ts | Checks loggy-serve availability |
| Action handlers | actions.ts | Button click handlers |
| Browser APIs | ../browser-apis/index.ts | Cross-browser API abstractions |

## CONVENTIONS

- **State updates**: Use spread operator for immutability
- **DOM queries**: Use `document.getElementById()` with type assertions
- **Event handlers**: Debounce input at 300ms
- **Async methods**: Always use try/catch
- **Error display**: Use React toast UI, not console-only
- **Chrome APIs**: Wrap in Promises for async/await compatibility
- **React patterns**: Functional components, hooks for state, no classes
- **Message passing**: Use `chrome.runtime.sendMessage()` with typed `LoggyMessage` to communicate with background

## ANTI-PATTERNS

- NEVER mutate state directly - use spread operator for updates
- NEVER skip error handling in async capture methods
- NEVER use `eval()` outside of `chrome.devtools.inspectedWindow.eval()`
- NEVER access DOM without caching element references
- NEVER use React class components - use functional components with hooks

## NOTES

- Console capture works by injecting a script that patches console methods
- Logs stored in inspected page's `window.__loggyConsoleLogs`
- Circular buffer limits console logs to prevent memory bloat
- Clipboard requires user gesture (button click) per browser security
- Panel UI is React-only; root files are panel business logic, not an alternate UI layer
- React components use hooks for state management and side effects
- Toast system is React-only (`src/components/Toast.tsx`)
- Panel communicates with background service worker for capture coordination and server export
- Capture data source depends on mode: content-script/debugger modes get data from background, devtools mode captures directly
