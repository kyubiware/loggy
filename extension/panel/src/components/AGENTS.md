# REACT COMPONENTS KNOWLEDGE BASE

**Scope:** UI Components for DevTools Panel

## OVERVIEW
React UI components for filter controls, data preview, and notifications.

## STRUCTURE
```
components/
├── controls/                  # Filter controls and action buttons (see controls/AGENTS.md)
│   ├── FiltersPanel.tsx        # Orchestrates filter controls
│   ├── ActionButtons.tsx       # Icon-based action buttons
│   ├── OptionCheckbox.tsx      # Minimal checkbox component
│   ├── FilterControl.tsx       # Composite control with label, toggle, input
│   └── useDebouncedFilter.ts   # Debouncing hook for inputs
├── ConsentView.tsx            # Consent gating UI
├── PreviewPane.tsx            # Console/network data preview tables (largest component)
├── PreviewContent.tsx         # Preview body renderer
├── PreviewPaneHeader.tsx      # Preview header with tabs + stats
├── Tabs.tsx / TabButton.tsx   # Console/Network tab switcher
├── RoutesList.tsx             # Route selection list (tri-state per normalized pattern)
├── FilterToggle.tsx           # Generic filter toggle primitive
├── StatsSummary.tsx           # Log count summary
├── TokenCountBadge.tsx        # Export token estimate badge
├── ServerConnection.tsx       # Server URL + connection state
├── ExportOptionToggles.tsx    # Export option checkboxes (bodies, agent context, etc.)
├── Toast.tsx                  # Notification component (3s auto-dismiss)
├── preview-line-parser.tsx    # Pure helpers for parsing preview lines
├── PreviewPane.test.tsx       # (~570 lines)
├── PreviewContent.test.tsx    # (~474 lines)
├── ActionsAndToast.test.tsx   # Integration tests
└── App.layout.test.tsx        # Layout tests
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Filter UI | controls/FiltersPanel.tsx | Orchestration of filter controls |
| Action buttons | controls/ActionButtons.tsx | Refresh, Copy buttons |
| Filter control | controls/FilterControl.tsx | Composite with label, toggle, input |
| Option checkbox | controls/OptionCheckbox.tsx | Minimal, test-driven |
| Debounced input | controls/useDebouncedFilter.ts | 300ms with refs |
| Console table | PreviewPane.tsx | Console log display |
| Network table | PreviewPane.tsx | HAR entry display |
| Preview body | PreviewContent.tsx | Rendered/raw markdown body |
| Preview header | PreviewPaneHeader.tsx | Tabs + stats summary |
| Console/Network tabs | Tabs.tsx + TabButton.tsx | Tab switcher |
| Route selection | RoutesList.tsx | Tri-state per normalized pattern (see utils/route-patterns.ts) |
| Server config | ServerConnection.tsx | URL + connection state |
| Export option checkboxes | ExportOptionToggles.tsx | Bodies, agent context, etc. |
| Stats summary | StatsSummary.tsx | Log counts |
| Token estimate | TokenCountBadge.tsx | Export size badge |
| Toast UI | Toast.tsx | 3s auto-dismiss |

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
