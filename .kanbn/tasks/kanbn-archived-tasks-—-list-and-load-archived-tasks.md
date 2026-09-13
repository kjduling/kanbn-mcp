---
created: 2026-09-12T05:04:44.022Z
updated: 2026-09-13T20:12:08.738Z
completed: 2026-09-13T20:12:08.738Z
---

# kanbn-archived-tasks — list and load archived tasks

Implement MCP tools for kanbn library archived task methods:
- `listArchivedTasks()` → `kanbn_list_archived_tasks`
- `loadArchivedTask(taskId)` → `kanbn_load_archived_task`

Acceptance criteria:
- `kanbn_list_archived_tasks` returns array of archived task IDs
- `kanbn_load_archived_task` returns full task data from archive
- Both respect the board path context
- Non-existent archived task returns clear error

## Sub-tasks

- [x] Implement `kanbn_list_archived_tasks` tool
- [x] Implement `kanbn_load_archived_task` tool with taskId param
- [x] Unit tests — happy paths (list with archives, load existing archived task)
- [x] Unit tests — sad paths (load non-existent archived task, empty archive)

## Comments

- author: Jinx
  date: 2026-09-13T20:30:00.000Z
  Implemented kanbn_list_archived_tasks (path only; wraps lib listArchivedTasks as 'Failed to list archived tasks: <msg>') and kanbn_load_archived_task (taskId required; wraps loadArchivedTask as 'Failed to load archived task: <msg>'). Both do the standard isBoardInitialized guard. Return the id array as compact JSON; the parsed task object pretty-printed. TOOLS entries, dispatch cases, HELP_TEXT, README rows, listTools array updated. 4 tests: list with archives (['alpha']), load existing (name + description intact), load non-existent (ENOENT wrapped), empty archive folder at .kanbn/archive returns []. 160/160 tests pass, tsc clean. Note: archive folder path is .kanbn/archive, not .kanbn/<board>/archive on the main board.

## History

- type: moved
  date: 2026-09-13T20:12:08.738Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
