# POPUP KNOWLEDGE BASE

## OVERVIEW
Small React application providing status display and debugger toggles for the Loggy extension.

## STRUCTURE
```
popup/
├── components/      # Popup-specific UI components (AlwaysLogHosts, FiltersAccordion, SettingsAccordion, ...)
├── hooks/           # usePopupActions, usePopupData, usePopupExport, usePopupSettings, isLoggingActive
├── Popup.tsx        # Root React component
├── popup.html       # HTML entry point (loaded by manifest)
├── constants.ts     # UI-specific constants and limits
└── index.css        # Popup-specific styles
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
- **Two data paths, one bundle**: Chrome path (`usePopupData`) messages the background; Firefox path (`useFirefoxDirectCapture`) reads the MAIN world directly because the popup runs in a different process. The branch lives in `usePopupActions` keyed on `typeof chrome.debugger === 'undefined'` (the only sanctioned runtime browser check — see memory 222).
- Chrome-only debugger features must be conditionally rendered
