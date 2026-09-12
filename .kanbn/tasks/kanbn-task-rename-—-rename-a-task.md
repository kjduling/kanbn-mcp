---
created: 2026-09-12T05:00:49.163Z
updated: 2026-09-12T22:15:30.662Z
completed: 2026-09-12T22:15:30.662Z
---

# kanbn-task-rename — rename a task

Implement MCP tool for kanbn library `renameTask(taskId, newTaskName)` method.

Acceptance criteria:
- `kanbn_rename_task` tool accepts taskId and newName
- Renames the task file and updates all index references
- Returns the new task ID (may change if name is part of ID)
- Moving task to a column is optional (position param)

## Sub-tasks

- [x] Implement kanbn_rename_task tool with taskId, newName, optional column/position params
- [x] Unit tests happy paths (rename existing task, verify file renamed and index updated)
- [x] Unit tests sad paths (non-existent task, empty name, duplicate name)

## Comments

- author: Jinx
  date: 2026-09-12T22:45:00.000Z
  Implemented kanbn_rename_task. Backs onto the library renameTask(taskId, newTaskName) which updates the task file, this board's index, and any other board referencing the task, returning the new task id (renameTaskInIndex). Tool accepts required taskId + newName, optional column/position (post-rename move via moveTask), and path. Resolution uses instance.renameTask || instance.rename. Empty/whitespace newName is rejected client-side. Tests: rename happy path (file+index updated, old id gone), rename+move with index assertion, and sad paths for missing task, empty name, and duplicate name. listTools expectation updated. 68/68 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-12T22:15:30.662Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
