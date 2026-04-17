# CONTROLS COMPONENTS KNOWLEDGE BASE

**Scope:** Filter controls and action buttons

## OVERVIEW
Stateless UI components for filter inputs and action buttons using React composition pattern.

## STRUCTURE
```
controls/
├── FiltersPanel.tsx      # Orchestrates all filter controls
├── ActionButtons.tsx      # Refresh, Copy, Clear buttons
├── FilterControl.tsx      # Composite: label, toggle, input
├── OptionCheckbox.tsx     # Minimal checkbox component
├── useDebouncedFilter.ts # 300ms debounce hook
└── *.test.tsx           # Component tests
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Filter orchestration | FiltersPanel.tsx | Conditional visibility rendering |
| Action buttons | ActionButtons.tsx | Icon buttons with handlers |
| Composite control | FilterControl.tsx | Label + toggle + input |
| Checkbox component | OptionCheckbox.tsx | Minimal, test-driven |
| Input debounce | useDebouncedFilter.ts | 300ms with refs |

## CONVENTIONS

- **Stateless**: No internal state - all via props
- **Composition**: Composite patterns (FilterControl = label + toggle + input)
- **Debouncing**: useDebouncedFilter wraps parent onChange
- **Styling**: Tailwind CSS utility classes
- **Test IDs**: All components accept testId prop

## ANTI-PATTERNS

- NEVER store state - parent owns all state
- NEVER inline complex logic - use composition
- NEVER skip testId props - test-driven design

## NOTES

- Controls use stateless composition: presentational components with callbacks
- useDebouncedFilter uses refs to prevent stale closures
- Test IDs propagate through component hierarchy for accessibility
- Components conditionally render based on parent visibility props
