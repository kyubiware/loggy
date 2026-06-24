# POPUP COMPONENTS KNOWLEDGE BASE

**Scope:** Popup-specific React UI components (12 components, 1006 LOC)

## OVERVIEW
Stateless presentational components for the popup surface. Two accordion sections (Filters / Settings) gate the bulk of the controls; header + capture toggle anchor the layout. All state lives in `popup/hooks/` — components receive props and emit callbacks.

## STRUCTURE
```
components/
├── PopupHeader.tsx              # Logo, capture mode display, logging status
├── EnhancedCaptureToggle.tsx    # Primary start/stop logging button
├── CaptureModeDisplay.tsx       # Current capture mode badge
├── AlwaysLogHosts.tsx           # Add/remove always-log hosts
├── FiltersAccordion.tsx         # Collapsible filters section
├── FilterInput.tsx              # Console regex + network pattern inputs
├── RoutesList.tsx               # Route selection (tri-state per normalized pattern)
├── ServerConnection.tsx         # Server URL + connection status
├── SettingsAccordion.tsx        # Collapsible settings section
├── ExportOptionCheckboxes.tsx   # Export option toggles (bodies, agent context, smart-mode, etc.)
├── TokenCountAndCopy.tsx        # Token estimate + copy-to-clipboard action
├── PopupHeader.test.tsx
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Header layout | PopupHeader.tsx | Logo + mode display + status |
| Logging toggle | EnhancedCaptureToggle.tsx | Single primary action button |
| Capture mode indicator | CaptureModeDisplay.tsx | debugger / content-script / devtools / inactive |
| Always-log hosts | AlwaysLogHosts.tsx | Add/remove host entries |
| Filters accordion | FiltersAccordion.tsx | Collapsible; gates FilterInput + RoutesList |
| Console/network filter input | FilterInput.tsx | Console regex, network include/exclude patterns |
| Route selection | RoutesList.tsx | Tri-state per normalized pattern (mirrors panel RoutesList) |
| Server URL config | ServerConnection.tsx | URL input + connection badge |
| Settings accordion | SettingsAccordion.tsx | Collapsible; gates ExportOptionCheckboxes + AlwaysLogHosts |
| Export option toggles | ExportOptionCheckboxes.tsx | All Markdown-export-affecting checkboxes |
| Copy + token estimate | TokenCountAndCopy.tsx | Final export size + copy action |

## CONVENTIONS

- **Stateless**: No internal state — all props come from `popup/hooks/`
- **Callback naming**: `on<Name>` (e.g. `onToggleLogging`, `onServerUrlChange`)
- **Shared components imported from `shared/components/`**: ConsentView, IconButtonToggle, Tooltip, OptionCheckbox — never re-implement here
- **Shared hooks imported from `shared/hooks/`**: useConsentActions, useRouteActions — popup-specific hooks wrap them
- **Tailwind utility classes**: no inline styles
- **testId props** on interactive elements for testing

## ANTI-PATTERNS

- NEVER add internal state — props in, callbacks out
- NEVER re-implement route toggle logic — use `useRouteActions` from `shared/hooks/`
- NEVER bypass `useConsentActions` for start/stop logging dispatch
- NEVER inline styles — use Tailwind classes
- NEVER hardcode text — use props or constants

## NOTES

- RoutesList mirrors the panel's RoutesList pattern (tri-state per normalized pattern from `utils/route-patterns.ts`)
- Accordion open/close state is part of `EXPORT_RELEVANT_SETTING_KEYS` (settingsAccordionOpen, filtersAccordionOpen) so the popup re-fetches on toggle
- ExportOptionCheckboxes is the popup counterpart to panel's `ExportOptionToggles` — same underlying settings, different component shape
