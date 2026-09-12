---
created: 2026-09-12T05:12:09.049Z
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

- [ ] Implement `kanbn_add_untracked_task` tool
- [ ] Implement `kanbn_find_tracked_tasks` tool with optional column param
- [ ] Implement `kanbn_find_untracked_tasks` tool
- [ ] Implement `kanbn_find_missing_task_files` tool
- [ ] Implement `kanbn_add_task_to_board` tool
- [ ] Implement `kanbn_find_task_boards` tool
- [ ] Implement `kanbn_task_file_exists` tool
- [ ] Implement `kanbn_task_exists` tool
- [ ] Implement `kanbn_find_task_column` tool
- [ ] Implement `kanbn_remove_all` tool (with safety guard)
- [ ] Unit tests — happy paths (all tools)
- [ ] Unit tests — sad paths (missing files, non-existent tasks, invalid columns)

## History

- type: created
  date: 2026-09-12T05:12:09.049Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
