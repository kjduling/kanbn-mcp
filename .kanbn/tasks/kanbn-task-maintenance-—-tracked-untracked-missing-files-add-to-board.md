---
created: 2026-09-12T05:12:09.049Z
updated: 2026-09-13T20:38:42.338Z
completed: 2026-09-13T20:38:42.338Z
---

# kanbn-task-maintenance — tracked/untracked, missing files, add to board

Implement MCP tools for kanbn library task maintenance methods:
- `addUntrackedTaskToIndex(taskId, columnName)` → `kanbn_add_untracked_task`
- `findTrackedTasks(columnName)` → `kanbn_find_tracked_tasks`
- `findUntrackedTasks()` → `kanbn_find_untracked_tasks`
- `findMissingTaskFiles(index)` → `kanbn_find_missing_task_files`
- `addTaskToBoard(taskId, columnName)` → `kanbn_add_task_to_board`
- `findTaskBoards(taskId)` → `kanbn_find_task_boards`
- `taskFileExists(taskId)` → `kanbn_task_file_exists`
- `taskExists(taskId)` → `kanbn_task_exists`
- `findTaskColumn(taskId)` → `kanbn_find_task_column`
- `removeAll()` → `kanbn_remove_all`

Acceptance criteria:
- `kanbn_add_untracked_task` adds an untracked task file to the index
- `kanbn_find_tracked_tasks` returns tracked task IDs, optionally filtered by column
- `kanbn_find_untracked_tasks` returns untracked task IDs
- `kanbn_find_missing_task_files` returns missing task files and their columns
- `kanbn_add_task_to_board` adds a task to a specific board
- `kanbn_find_task_boards` returns which boards and columns reference a task
- `kanbn_task_file_exists` returns boolean
- `kanbn_task_exists` throws if task not indexed
- `kanbn_find_task_column` returns the column name or throws
- `kanbn_remove_all` nukes everything (with confirmation)

## Sub-tasks

- [x] Implement `kanbn_add_untracked_task` tool
- [x] Implement `kanbn_find_tracked_tasks` tool with optional column param
- [x] Implement `kanbn_find_untracked_tasks` tool
- [x] Implement `kanbn_find_missing_task_files` tool
- [x] Implement `kanbn_add_task_to_board` tool
- [x] Implement `kanbn_find_task_boards` tool
- [x] Implement `kanbn_task_file_exists` tool
- [x] Implement `kanbn_task_exists` tool
- [x] Implement `kanbn_find_task_column` tool
- [x] Implement `kanbn_remove_all` tool (with safety guard)
- [x] Unit tests — happy paths (all tools)
- [x] Unit tests — sad paths (missing files, non-existent tasks, invalid columns)

## Comments

- author: Jinx
  date: 2026-09-13T22:45:00.000Z
  Implemented all 10 task-maintenance tools: kanbn_add_untracked_task, kanbn_find_tracked_tasks (optional column filter), kanbn_find_untracked_tasks, kanbn_find_missing_task_files, kanbn_add_task_to_board, kanbn_find_task_boards, kanbn_task_file_exists, kanbn_task_exists, kanbn_find_task_column, kanbn_remove_all (requires confirm: true). Shared readyBoard() helper for path/instance/initialised resolution; Set results → arrays, lib errors wrapped per-tool (e.g. Failed to find tracked tasks: <msg>). TOOLS entries (taskId/columnName required where relevant), dispatch cases, HELP_TEXT rows, README rows, listTools entries. 12 tests (174 → 186) covering happy + sad paths incl. already-indexed rejection, invalid column, missing task files, unindexed/missing task errors, remove_all confirmation guard.

## History

- type: moved
  date: 2026-09-13T20:38:42.338Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
