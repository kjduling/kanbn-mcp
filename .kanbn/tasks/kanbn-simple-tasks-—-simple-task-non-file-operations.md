---
created: 2026-09-12T05:09:14.085Z
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

- [ ] Implement `kanbn_find_simple_tasks` tool with optional input param
- [ ] Implement `kanbn_get_simple_task` tool with input param
- [ ] Implement `kanbn_move_simple_task` tool with input, column, position params
- [ ] Implement `kanbn_move_simple_task_to_board` tool with input, targetSlug, column, position params
- [ ] Implement `kanbn_delete_simple_task` tool with input param
- [ ] Implement `kanbn_promote_simple_task` tool with input, optional column params
- [ ] Unit tests — happy paths (find, get, move, promote, delete simple tasks)
- [ ] Unit tests — sad paths (ambiguous match, non-existent simple task, missing target board)

## History

- type: created
  date: 2026-09-12T05:09:14.085Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
