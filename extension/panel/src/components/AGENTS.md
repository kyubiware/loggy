# REACT COMPONENTS KNOWLEDGE BASE

**Scope:** UI Components for DevTools Panel

## OVERVIEW
React UI components for filter controls, data preview, and notifications.

## STRUCTURE
```
components/
├── controls/              # Filter controls and action buttons
│   ├── FiltersPanel.tsx   # Orchestrates filter controls
│   ├── ActionButtons.tsx  # Icon-based action buttons
│   ├── OptionCheckbox.tsx # Minimal checkbox component
│   ├── FilterControl.tsx   # Composite control with label, toggle, input
│   └── useDebouncedFilter.ts # Debouncing hook for inputs
├── PreviewPane.tsx        # Console/network data preview tables
├── Toast.tsx              # Toast notification component
├── *.test.tsx            # Component tests
└── App.layout.test.tsx    # Layout tests
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Filter UI | controls/FiltersPanel.tsx | Orchestration of filter controls |
| Action buttons | controls/ActionButtons.tsx | Refresh, Copy buttons |
| Filter control | controls/FilterControl.tsx | Composite with label, toggle, input |
| Option checkbox | controls/OptionCheckbox.tsx | Minimal checkbox component |
| Debounced input | controls/useDebouncedFilter.ts | 300ms debounce hook |
| Console table | PreviewPane.tsx | Console log display |
| Network table | PreviewPane.tsx | HAR entry display |
| Toast UI | Toast.tsx | Notification component |

## CONVENTIONS

- **Stateless components**: Controls receive all state via props, delegate changes upward via callbacks
- **Props**: TypeScript interfaces for all props
- **Styling**: Tailwind CSS utility classes
- **Event handlers**: on<Name> naming convention
- **Conditional rendering**: ternary operators or logical AND
- **Test IDs**: All components accept testId props for accessibility and testing

## ANTI-PATTERNS

- NEVER use inline styles - use Tailwind classes
- NEVER skip prop types - use TypeScript interfaces
- NEVER hardcode text values - use props or constants
- NEVER mix concerns - keep components focused
- NEVER store state in controls - delegate all state to parent hooks
- NEVER create internal state for UI only - use props from parent

## NOTES

- Components tested with React Testing Library
- PreviewPane handles both console and network data rendering
- Toast auto-dismisses after 3 seconds
- Controls/ directory uses stateless composition pattern
  - Controls are purely presentational, no internal state
  - All state owned by parent hook (useCaptureData)
  - Callbacks delegate changes upward (onChange, onToggleVisibility)
  - useDebouncedFilter hook wraps parent onChange with 300ms debounce
- Test ID props baked into component APIs for test-driven design
