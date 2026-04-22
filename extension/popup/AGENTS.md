# POPUP KNOWLEDGE BASE

## OVERVIEW
Small React application providing status display and debugger toggles for the Loggy extension.

## STRUCTURE
```
popup/
├── components/     # Popup-specific UI components
├── hooks/          # Hooks for status polling and actions
├── popup.tsx       # Root React component and entry logic
├── popup.html      # HTML entry point (loaded by manifest)
├── constants.ts    # UI-specific constants and limits
└── index.css       # Popup-specific styles
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Status polling | hooks/ | Fetches capture state from background |
| Toggle logic | popup.tsx | Dispatches debugger enable/disable |
| Shared UI | extension/shared/ | Imports IconButtonToggle, Tooltip |
| Message types | extension/types/ | Uses LoggyMessage for communications |

## CONVENTIONS
- Minimal state: rely on background service worker as source of truth
- Use `chrome.runtime.sendMessage` for all background interactions
- Atomic components in `components/`, business logic in `hooks/`

## ANTI-PATTERNS
- **NO heavy data processing** — Move log formatting to `extension/utils/`
- **NO direct storage access** — Always request state via background messages
- **NO debugger logic** — Popup only triggers; logic resides in `capture/`

## NOTES
- Entry flow: `popup.html` -> `popup.tsx`
- Simpler than the panel; no dual React/vanilla architecture
- Chrome-only debugger features must be conditionally rendered
