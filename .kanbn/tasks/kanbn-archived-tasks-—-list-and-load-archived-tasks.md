---
created: 2026-09-12T05:04:44.022Z
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

- [ ] Implement `kanbn_list_archived_tasks` tool
- [ ] Implement `kanbn_load_archived_task` tool with taskId param
- [ ] Unit tests — happy paths (list with archives, load existing archived task)
- [ ] Unit tests — sad paths (load non-existent archived task, empty archive)

## History

- type: created
  date: 2026-09-12T05:04:44.022Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
