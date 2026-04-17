# REACT PANEL KNOWLEDGE BASE

**Scope:** React UI for DevTools Panel

## OVERVIEW
React application providing the DevTools panel UI with filter controls, data preview, and toast notifications.

## STRUCTURE
```
src/
├── main.tsx           # React entry point (mounts App)
├── App.tsx            # Main component (orchestration)
├── index.css          # Global styles
├── components/        # UI components
│   ├── controls/      # Filter controls and action buttons
│   ├── PreviewPane.tsx  # Console/network data preview
│   ├── Toast.tsx     # Toast notification component
│   └── *.test.tsx    # Component tests
└── hooks/             # React hooks
    ├── useCaptureData.ts   # Console/network capture logic
    ├── useToast.ts         # Toast state management
    └── *.test.tsx         # Hook tests
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| React mounting | main.tsx | ReactDOM.createRoot |
| App layout | App.tsx | Component structure |
| Filter inputs | components/controls/ | State-bound inputs |
| Preview display | components/PreviewPane.tsx | Data tables |
| Toast UI | components/Toast.tsx | Notification component |
| Data capture | hooks/useCaptureData.ts | Chrome API integration |
| Toast state | hooks/useToast.ts | Visibility/timeout |

## CONVENTIONS

- **Components**: Functional components with hooks only (no classes)
- **State**: useState, useEffect for local state
- **Event handlers**: Inline handlers with useCallback optimization
- **Styling**: Tailwind CSS classes (via index.css import)
- **Testing**: React Testing Library, @testing-library/jest-dom

## ANTI-PATTERNS

- NEVER use class components - use functional components
- NEVER mutate state directly - use setState
- NEVER skip cleanup in useEffect - return cleanup function
- NEVER inline complex functions - use useCallback/useMemo

## NOTES

- Components are tested with React Testing Library
- useCaptureData handles all Chrome DevTools API interactions
- useToast manages toast visibility and auto-dismissal
- Tailwind CSS used for styling via CDN in index.css
