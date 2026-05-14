# REACT PANEL KNOWLEDGE BASE

**Scope:** React UI for DevTools Panel

## OVERVIEW
React application providing the DevTools panel UI with filter controls, data preview, toast notifications, and consent gating.

## STRUCTURE
```
src/
├── main.tsx                 # React entry point
├── App.tsx                  # App shell (LoggyProvider + AppContent)
├── AppContent.tsx           # Main layout orchestration
├── LoggyContext.tsx         # Three-context provider
├── LoggyContext.types.ts    # Context value type definitions
├── index.css                # Global styles (Tailwind)
├── components/              # UI components
│   ├── controls/            # Filter controls and action buttons
│   ├── PreviewPane.tsx      # Console/network data preview
│   ├── Toast.tsx            # Toast notification
│   ├── ConsentView.tsx      # Consent gating UI
│   └── *.test.tsx
└── hooks/
    ├── useCaptureData.ts    # Background messaging
    ├── useLoggyActions.ts   # Action creators
    ├── useConsentCheck.ts   # Consent state → ConsentView
    ├── useToast.ts          # Toast state
    └── *.test.tsx
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Three-context provider | LoggyContext.tsx | LogDataContext, SettingsContext, ActionsContext |
| Context types | LoggyContext.types.ts | Typed context values |
| Consent gating | ConsentView.tsx + useConsentCheck.ts | Start/Always Log |
| Action creators | useLoggyActions.ts | Filters, routes, copy, clear, refresh |
| Data capture | useCaptureData.ts | chrome.runtime.sendMessage |
| Filter inputs | components/controls/ | State-bound inputs |
| Preview display | PreviewPane.tsx | Data tables |

## CONVENTIONS

- **Components**: Functional components with hooks only
- **State**: Three-context pattern — LogDataContext (data), SettingsContext (config), ActionsContext (operations)
- **Styling**: Tailwind CSS (PostCSS/Vite)
- **Testing**: React Testing Library

## ANTI-PATTERNS

- NEVER use class components
- NEVER mutate state directly
- NEVER bypass the three-context pattern — use useLogData, useSettings, useActions hooks

## NOTES

- useLoggyActions centralizes all panel operations
- useConsentCheck manages consent flow, renders ConsentView when not consented
- LoggyProvider wraps children in three nested context providers
