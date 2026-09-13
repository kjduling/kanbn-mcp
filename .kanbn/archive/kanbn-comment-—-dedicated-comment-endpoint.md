---
created: 2026-09-12T05:10:02.281Z
updated: 2026-09-13T16:31:58.362Z
completed: 2026-09-13T16:31:58.362Z
column: Done
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

- [x] Implement `kanbn_comment` tool with taskId, text, optional author params
- [x] Unit tests — happy paths (add comment, verify comment appended)
- [x] Unit tests — sad paths (non-existent task, empty text)

## Comments

- author: Jinx
  date: 2026-09-13T02:45:00.000Z
  kanbn_comment implemented: requires taskId + text, optional author. Default author resolved via lib currentUser() = KANBN_USER env → git config email/name → empty string. Calls instance.comment() which appends (never overwrites); lib throws for missing task / empty text / not indexed. Handler returns 'Commented on task "X"'. 102/102 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T16:31:58.362Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T16:56:01.066Z
  fromColumn: Done
  author: Kevin J. Duling
