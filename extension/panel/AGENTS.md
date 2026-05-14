# PANEL KNOWLEDGE BASE

**Scope:** DevTools Panel UI (React-only)

## OVERVIEW
Main DevTools panel UI. Fully React-based with a three-context architecture (LogDataContext, SettingsContext, ActionsContext) managed by LoggyProvider. Consent gating controls entry into the main app.

## STRUCTURE
```
panel/
├── src/
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Consent gate → LoggyProvider → AppContent
│   ├── AppContent.tsx        # Layout: PreviewPane + Toast
│   ├── LoggyContext.tsx      # Three-context provider (LoggyProvider)
│   ├── LoggyContext.types.ts # Context value type definitions
│   ├── index.css             # Tailwind styles
│   ├── components/           # React UI components
│   │   ├── ConsentView.tsx   # Pre-consent screen
│   │   ├── PreviewPane.tsx   # Main data display
│   │   ├── PreviewContent.tsx
│   │   ├── PreviewPaneHeader.tsx
│   │   ├── Tabs.tsx / TabButton.tsx
│   │   ├── RoutesList.tsx
│   │   ├── FilterToggle.tsx
│   │   ├── StatsSummary.tsx
│   │   ├── TokenCountBadge.tsx
│   │   ├── ServerConnection.tsx
│   │   ├── ExportOptionToggles.tsx
│   │   ├── Toast.tsx
│   │   └── *.test.tsx        # Component tests
│   └── hooks/
│       ├── useCaptureData.ts      # Console/network capture logic
│       ├── useLoggyActions.ts     # Action dispatcher + toggle configs
│       ├── useConsentCheck.ts     # Consent state management
│       ├── useFilteredData.ts     # Filtered data hook
│       ├── useToast.ts            # Toast state management
│       └── useCaptureData.test.tsx
├── capture.ts              # Console & network capture (DevTools API)
├── preview.ts              # Preview rendering helpers
├── server-probe.ts         # Server availability check
└── actions.ts              # Pure action handlers (clear, copy)
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Consent gating | src/App.tsx + hooks/useConsentCheck.ts | Checks consent before rendering app |
| Context provider | src/LoggyContext.tsx | LoggyProvider wraps LogDataContext, SettingsContext, ActionsContext |
| Context types | src/LoggyContext.types.ts | LogDataContextValue, SettingsContextValue, ActionsContextValue |
| Layout | src/AppContent.tsx | PreviewPane + Toast, uses useSettings() |
| Data access | useLogData() hook | consoleLogs, networkEntries, routeOptions, selectedRoutes |
| Settings access | useSettings() hook | All filter/visibility/export/server flags |
| Actions | useActions() hook | refresh, clearAll, copy, toggleSetting, setServerUrl, route ops |
| Toggle configs | hooks/useLoggyActions.ts | TOGGLE_CONFIGS array for data-driven toggle UI |
| Capture logic | hooks/useCaptureData.ts | State reducer, captureData, clearData |
| Preview rendering | preview.ts | Non-React DOM helpers |
| Server probe | server-probe.ts | Checks loggy-serve availability |
| Clipboard/server export | ../../shared/export.ts, server-export.ts | formatMarkdown, pushToServer |

## CONVENTIONS

- **Three-context pattern**: LogDataContext (data), SettingsContext (flags/state), ActionsContext (dispatchers). All provided by LoggyProvider.
- **Consent gate**: App.tsx checks consent first. Renders ConsentView if not consented, LoggyProvider + AppContent if consented.
- **State immutability**: Use spread operator; reducer actions defined in useCaptureData.
- **Event handlers**: Debounce input at 300ms.
- **Async methods**: Always use try/catch.
- **Error display**: React Toast component, not console-only.
- **Circular buffer**: Console/network logs pruned to prevent memory bloat.
- **No vanilla JS DOM manipulation**: Panel is React-only. preview.ts provides helpers but UI is React-driven.
- **Browser APIs**: Never import directly. Use ../../browser-apis/index.ts abstraction.
- **TypeScript strict**: No implicit any. All hooks and contexts fully typed.
