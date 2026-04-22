# REACT PANEL KNOWLEDGE BASE

**Scope:** React UI for DevTools Panel

## OVERVIEW
React application providing the DevTools panel UI with filter controls, data preview, and toast notifications.

## STRUCTURE
```
src/
├── main.tsx           # React entry point (mounts App)
├── App.tsx            # App shell (LoggyProvider + AppContent)
├── AppContent.tsx     # Main layout orchestration
├── LoggyContext.tsx   # Shared state (LoggyProvider)
├── index.css          # Global styles (Tailwind via PostCSS)
├── components/        # UI components
│   ├── controls/      # Filter controls and action buttons
│   ├── PreviewPane.tsx  # Console/network data preview
│   ├── Toast.tsx     # Toast notification component
│   └── *.test.tsx    # Component tests
└── hooks/             # React hooks
    ├── useCaptureData.ts   # Messaging with background service worker
    ├── useToast.ts         # Toast state management
    └── *.test.tsx         # Hook tests
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| React mounting | main.tsx | ReactDOM.createRoot |
| Shared state | LoggyContext.tsx | LoggyProvider & useLoggy |
| App layout | AppContent.tsx | Main component structure |
| Filter inputs | components/controls/ | State-bound inputs |
| Preview display | components/PreviewPane.tsx | Data tables |
| Toast UI | components/Toast.tsx | Notification component |
| Data capture | hooks/useCaptureData.ts | Messaging via chrome.runtime.sendMessage |
| Toast state | hooks/useToast.ts | Visibility/timeout |

## CONVENTIONS

- **Components**: Functional components with hooks only (no classes)
- **State**: LoggyContext for shared state, useState for local
- **Event handlers**: Inline handlers with useCallback optimization
- **Styling**: Tailwind CSS classes (PostCSS/Vite plugin)
- **Testing**: React Testing Library, @testing-library/jest-dom

## ANTI-PATTERNS

- NEVER use class components - use functional components
- NEVER mutate state directly - use setState
- NEVER skip cleanup in useEffect - return cleanup function
- NEVER inline complex functions - use useCallback/useMemo

## NOTES

- Components are tested with React Testing Library
- useCaptureData communicates with background via chrome.runtime.sendMessage()
- useCaptureData uses typed LoggyMessage from types/messages.ts
- useToast manages toast visibility and auto-dismissal
- Tailwind CSS is compiled via PostCSS (Vite), not CDN
- LoggyContext provides shared state across the panel app
