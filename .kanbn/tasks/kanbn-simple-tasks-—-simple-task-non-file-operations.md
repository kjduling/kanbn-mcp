---
created: 2026-09-12T05:09:14.085Z
updated: 2026-09-12T22:24:23.691Z
completed: 2026-09-12T22:24:23.691Z
---

# kanbn-simple-tasks — simple task (non-file) operations

Implement MCP tools for kanbn library simple task methods:
- `findSimpleTasks(input, index)` → `kanbn_find_simple_tasks`
- `getSimpleTask(input)` → `kanbn_get_simple_task`
- `moveSimpleTask(input, columnName, position)` → `kanbn_move_simple_task`
- `moveSimpleTaskToBoard(input, targetSlug, columnName, position)` → `kanbn_move_simple_task_to_board`
- `deleteSimpleTask(input)` → `kanbn_delete_simple_task`
- `promoteSimpleTask(input, columnName)` → `kanbn_promote_simple_task`

Acceptance criteria:
- `kanbn_find_simple_tasks` returns simple tasks matching input title (or all if null)
- `kanbn_get_simple_task` resolves to exactly one simple task or throws
- `kanbn_move_simple_task` moves a simple task to another column
- `kanbn_move_simple_task_to_board` moves a simple task to another board
- `kanbn_delete_simple_task` removes a simple task
- `kanbn_promote_simple_task` converts a simple task into a real task file

## Sub-tasks

- [x] Implement kanbn_find_simple_tasks tool with optional input param
- [x] Implement kanbn_get_simple_task tool with input param
- [x] Implement kanbn_move_simple_task tool with input, column, position params
- [x] Implement kanbn_move_simple_task_to_board tool with input, targetSlug, column, position params
- [x] Implement kanbn_delete_simple_task tool with input param
- [x] Implement kanbn_promote_simple_task tool with input, optional column params
- [x] Unit tests happy paths (find, get, move, promote, delete simple tasks)
- [x] Unit tests sad paths (ambiguous match, non-existent simple task, missing target board)

## Comments

- author: Jinx
  date: 2026-09-12T23:05:00.000Z
  Implemented all six simple-task tools, backed by library methods findSimpleTasks/getSimpleTask/moveSimpleTask/moveSimpleTaskToBoard/deleteSimpleTask/promoteSimpleTask. Tests seed simple tasks via getIndex + columnContent (raw "- <text>", block:false) + saveIndex. Happy + sad paths covered (find by title/all, get resolve/ambiguous/missing, move, move-to-board with secondary board, delete, promote + promote-clash). BONUS FIND: handleKanbnInitBoard called initialise(name, columns) positionally, but kanbn's real signature is initialise(options) - the first attempt silently created a DEFAULT board (Project Name / Backlog+defaults), dropping requested columns; existing tests passed only because their columns overlapped kanbn's defaults (my Pending column was dropped, which surfaced it). Fixed by calling the options-object form first with positional as fallback. README tool table updated. 78/78 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-12T22:24:23.691Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
