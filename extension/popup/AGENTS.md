# POPUP KNOWLEDGE BASE

## OVERVIEW
Small React application providing status display and debugger toggles for the Loggy extension.

## STRUCTURE
```
popup/
├── Popup.tsx             # Root React component
├── popup.html            # HTML entry point (loaded by manifest)
├── constants.ts          # UI-specific constants and limits
├── index.css             # Popup-specific styles
├── components/           # Popup-specific UI components (see popup/components/AGENTS.md)
│   ├── PopupHeader.tsx           # Header with logo + capture mode
│   ├── EnhancedCaptureToggle.tsx # Main start/stop logging button
│   ├── CaptureModeDisplay.tsx    # Current capture mode indicator
│   ├── AlwaysLogHosts.tsx        # Always-log host list management
│   ├── FiltersAccordion.tsx      # Collapsible filters section
│   ├── FilterInput.tsx           # Console/network filter inputs
│   ├── RoutesList.tsx            # Route selection (tri-state per pattern)
│   ├── ServerConnection.tsx      # Server URL + connection status
│   ├── SettingsAccordion.tsx     # Collapsible settings section
│   ├── ExportOptionCheckboxes.tsx # Export option toggles (bodies, agent context, etc.)
│   ├── TokenCountAndCopy.tsx     # Token estimate + copy-to-clipboard
│   └── *.test.tsx
└── hooks/                # Popup business logic (see popup/hooks/AGENTS.md)
    ├── usePopupActions.ts        # Action dispatch; branches on __BROWSER__
    ├── usePopupData.ts           # Status polling + settingsFingerprint re-fetch
    ├── usePopupExport.ts         # Export actions
    ├── usePopupSettings.ts       # Settings state
    ├── isLoggingActive.ts        # Logging active predicate
    └── *.test.ts
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Status polling | `hooks/usePopupData.ts` | Sends `get-tab-export-data` runtime message; re-fetches on `settingsFingerprint` of `EXPORT_RELEVANT_SETTING_KEYS` |
| Firefox direct capture | `hooks/useFirefoxDirectCapture.ts` (see below) | Reads MAIN world `window.__loggy{Console,Network}Logs` via `chrome.scripting.executeScript`, 2s poll |
| Action dispatch (debugger toggle, start/stop) | `hooks/usePopupActions.ts` | Branches on `typeof chrome.debugger === 'undefined'` to select data path |
| Browser path branching | `hooks/usePopupActions.ts` | Single runtime check; same bundle ships in both browsers |
| Shared UI | `extension/shared/` | Imports ConsentView, IconButtonToggle, Tooltip, useConsentActions, useRouteActions |
| Message types | `extension/types/` | Uses LoggyMessage for communications |

## CONVENTIONS
- Minimal state: rely on background service worker as source of truth
- Use `chrome.runtime.sendMessage` for all background interactions
- Atomic components in `components/`, business logic in `hooks/`
- When adding a new persisted setting that affects Markdown export, add its key to `EXPORT_RELEVANT_SETTING_KEYS` in `hooks/usePopupData.ts` so the Chrome path re-fetches when it changes

## ANTI-PATTERNS
- **NO heavy data processing** — Move log formatting to `extension/utils/`
- **NO direct storage access** — Always request state via background messages
- **NO debugger logic** — Popup only triggers; logic resides in `capture/`
- **NO `fetch()` for server probe/push** — delegate via background (Firefox DevTools CORS)

## NOTES
- Entry flow: `popup.html` -> `Popup.tsx`
- Simpler than the panel; no dual React/vanilla architecture
- **Two data paths, one bundle, branched on `__BROWSER__` (NOT runtime detection — see project memory 222)**: Chrome path (`usePopupData`) messages the background; Firefox path uses MAIN world direct read. The branch lives in `usePopupActions` keyed on the build-time `__BROWSER__` define.
- **Unified `usePopupData` hook** (Chrome path): sends `get-tab-export-data` runtime message, polls every 2s (`POLL_INTERVAL_MS=2000`), and uses `settingsFingerprint` (JSON.stringify of `EXPORT_RELEVANT_SETTING_KEYS` values) to trigger re-fetch only when export-relevant settings change. Background `handleGetTabExportData` reads all settings fresh from `chrome.storage.local` each call. Both paths converge on `getFilteredPanelData`.
- Chrome-only debugger features must be conditionally rendered
- See popup/components/AGENTS.md and popup/hooks/AGENTS.md for subdirectory detail
