---
created: 2026-09-12T05:10:02.281Z
---

# kanbn-comment — dedicated comment endpoint

Implement MCP tool for kanbn library `comment(taskId, text, author)` method.

Currently comments can only be set via `editTask` but there's no dedicated comment addition.

Acceptance criteria:
- `kanbn_comment` tool accepts taskId, text, and optional author
- Appends a comment to the task (not overwriting existing comments)
- Returns the updated task ID
- Uses KANBN_USER or git identity as default author when none provided

## Sub-tasks

- [ ] Implement `kanbn_comment` tool with taskId, text, optional author params
- [ ] Unit tests — happy paths (add comment, verify comment appended)
- [ ] Unit tests — sad paths (non-existent task, empty text)

## History

- type: created
  date: 2026-09-12T05:10:02.281Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
