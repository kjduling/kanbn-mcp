---
progress: 1
tags:
  - bug
  - high
created: 2026-10-14T02:36:08.761Z
updated: 2026-10-14T03:13:17.684Z
started: 2026-10-14T02:49:09.303Z
completed: 2026-10-14T02:52:28.536Z
---

# Case-insensitive column name resolution for kanbn tools

When a caller passes a column name that differs only in case from the board's actual column (e.g. "TODO" or "ToDo" when the index stores "Todo"), kanbn-mcp rejects it with: Column "TODO" doesn't exist.

The VS Code kanbn UI renders column headings in uppercase, so "TODO", "IN PROGRESS" and "DONE" are the natural strings to type — which makes this easy to hit in normal use.

Root cause: column lookups are exact, case-sensitive membership checks against index.columns with no normalisation. The underlying @basementuniverse/kanbn library performs the check (`if (!(columnName in index.columns)) throw new Error(...)`) in createTask, moveTask, addTaskToBoard, addUntrackedTaskToIndex, moveSimpleTask, promoteSimpleTask, subtask and sort, and the MCP passes the caller's string straight through.

Expected: kanbn-mcp should resolve the requested column against the board index case-insensitively (trimmed; an exact match wins, then a case-insensitive match) and hand the canonical column name to the library. When nothing matches, it should throw a clear error that lists the board's valid column names.

Affected tools that take a column argument: kanbn_create_task (column/col), kanbn_move_task (targetColumn/column/col), kanbn_rename_task (column), kanbn_add_task_to_board (columnName), kanbn_add_untracked_task (columnName), kanbn_find_tracked_tasks (columnName filter), kanbn_sort_column (columnName), kanbn_move_simple_task (column), kanbn_move_simple_task_to_board (column), kanbn_promote_simple_task (column).

## Sub-tasks

- [x] Add a resolveColumnName(index, requested) helper in src/kanbn/ that returns the canonical column name for a trimmed, case-insensitive match (exact match wins), or null/throws when there is no match
- [x] Apply the helper in handleKanbnCreateTask (column/col) before calling createTask, passing the canonical name
- [x] Apply the helper in handleKanbnMoveTask (targetColumn/column/col)
- [x] Apply the helper to rename_task (column), add_task_to_board (columnName), add_untracked_task (columnName), find_tracked_tasks (columnName filter) and sort_column (columnName)
- [x] Apply the helper to the simple-task handlers: move_simple_task, move_simple_task_to_board and promote_simple_task
- [x] When no column matches, throw an error that lists the board's valid column names
- [x] Verify kanbn_create_task with column "TODO" lands the task in the index's "Todo" column
- [x] Verify kanbn_move_task with targetColumn "todo" (lowercase) moves a task into "Todo"
- [x] Verify an unknown column (e.g. "Nope") still fails, with an error listing the valid columns
- [x] Add a unit test for the resolveColumnName helper: exact match, case-insensitive match, trimmed match, and no match
- [x] Add a regression test that create/move accept "TODO"/"in progress" and persist the task under the canonical column name

## Comments

- author: Kevin J. Duling
  date: 2026-10-14T02:52:28.525Z
  Fixed. New src/kanbn/columns.ts with a pure matchColumnName(columnNames, requested) and async resolveColumnName(instance, requested) and getColumnNames(instance). Resolution: exact trimmed match wins, otherwise a unique case-insensitive trimmed match; otherwise throw `Column "X" doesn't exist. Valid columns: "A", "B"`.
  
  Wired into: create_task (column/col), move_task (targetColumn), rename_task (column) [src/tools/task.ts]; sort_column [src/tools/board.ts]; add_untracked_task, add_task_to_board, find_tracked_tasks filter [src/tools/maintenance.ts]; move_simple_task, promote_simple_task [src/tools/simpleTasks.ts].
  
  Deliberate deviation for move_simple_task_to_board: that column lives on the TARGET board, not this one, so it is resolved against instance.board(targetSlug) when possible, and falls back to the raw value otherwise so the library's board-aware `Column "x" doesn't exist on board "y"` error is preserved (no regression for cross-board moves).
  
  Tests: 6 new tests in tests/kanbn-mcp.test.ts (pure helper incl. ambiguity/empty; create lands in canonical column; move with lowercase target; unknown column error lists valid columns; sort_column lowercase; find_tracked_tasks lowercase filter). Full suite 263 tests / 47 suites, all pass. npm run build clean.
  
  Files: src/kanbn/columns.ts (new), src/server.ts, src/tools/task.ts, src/tools/board.ts, src/tools/maintenance.ts, src/tools/simpleTasks.ts, tests/kanbn-mcp.test.ts. Not committed (user commits).

## History

- type: progress
  date: 2026-10-14T03:13:17.684Z
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
