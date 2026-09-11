---
created: 2026-09-11T03:10:12.421Z
started: 2026-09-11T03:10:12.421Z
column: 'In Progress'
---

# implement-kanbn-unarchive-task-tool

Implement the `kanbn_unarchive_task` (and `kanbn_restore_task` alias) MCP tool for restoring archived tasks.

The Kanbn library provides `restoreTask` which is the unarchive equivalent. Need to expose this via MCP tools.

**Implementation:**
1. Add `kanbn_unarchive_task` tool to `TOOLS` array (required param: `taskId`)
2. Add `kanbn_restore_task` as an alias (matching Kanbn's `restoreTask` method name)
3. Implement `handleKanbnUnarchiveTask` handler that calls Kanbn's `restoreTask` method
4. Add routing in `handleToolCall`

**Tests:**
- Happy path: successfully unarchive a task, verify it appears in a non-archived column
- Sad path: throws when task doesn't exist

**README:**
- Add "restoring archived tasks" to Features list
- Add `kanbn_unarchive_task` and `kanbn_restore_task` to Available tools table

## Sub-tasks

- [x] Acceptance: `kanbn_unarchive_task` tool restores an archived task and makes it visible in a non-archived column
- [x] Acceptance: `kanbn_restore_task` alias works identically to `kanbn_unarchive_task`
- [x] Acceptance: Tool throws when the task doesn't exist
- [x] Write unit tests for happy and sad paths
- [x] Update README with unarchive tool documentation

## History

- type: created
  date: 2026-09-11T03:10:12.421Z
  column: In Progress
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: archived
  date: 2026-09-11T03:35:22.210Z
  fromColumn: In Progress
  author: Kevin J. Duling
