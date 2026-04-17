---
description: Commit all changes with descriptive message
agent: build
model: opencode/grok-code
---

Commit all changes following repository guidelines.

Steps:

1. Run `git status`, `git diff`, and `git log --oneline -5` in parallel to review all changes
2. Analyze changes and draft a commit message
3. Follow commit message format: `<type>: <description>`
4. Valid types: feat, fix, refactor, docs, style, test, chore, perf
5. Use lowercase, imperative mood, no trailing period
6. Run `git add . && git commit -m "<message>"`
7. Verify with `git status`

Reference: docs/agent-instructions/commit_message_guidelines.md
