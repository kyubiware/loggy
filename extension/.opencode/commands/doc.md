---
description: Write the current plan to a document following plan conventions
agent: build
model: opencode/grok-code
---

Write the current plan to a document following repository conventions.

Steps:

1. Identify the plan from conversation context or user input
2. Read docs/agent-instructions/plan_doc_conventions.md for formatting requirements
3. Generate document path:
   - Use `docs/plans/active/` for STATUS: IN_PROGRESS, NOT_STARTED, or NEEDS_TESTING
   - Use `docs/plans/archive/` for STATUS: COMPLETE, PAUSED, or DEPRECATED
   - Use kebab-case naming: `[topic]_plan.md` or `[topic]_feature.md`
4. Create document with required header block:
   - `# <Feature Name> — <Plan/Feature/Instructions>`
   - `STATUS:` (required)
   - `TYPE:` (required: PLAN/FEATURE/INSTRUCTIONS/REFERENCE)
   - `LINEAR_ISSUE:` (optional, markdown link)
   - `RELATED_ROADMAP:` (optional, markdown link)
   - `DEPENDENCIES:` (optional)
   - `BLOCKING:` (optional)
   - `RISK_NOTES:` (optional)
5. Add ## CURRENT_STEP section with:
   - Category: CORE/STABILITY/DOCUMENTATION
   - Concrete next step description
   - Clear resumption instructions
6. Organize steps into three categories with checkboxes:
   - ## Core Implementation Steps
   - ## Stability & Polish Steps
   - ## Documentation Steps
7. Write document content following all conventions in plan_doc_conventions.md
8. Make NO OTHER CHANGES - only create/write the document file

Reference: docs/agent-instructions/plan_doc_conventions.md
