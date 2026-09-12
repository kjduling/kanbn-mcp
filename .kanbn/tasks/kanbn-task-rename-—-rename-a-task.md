---
created: 2026-09-12T05:00:49.163Z
---

# kanbn-task-rename — rename a task

Implement MCP tool for kanbn library `renameTask(taskId, newTaskName)` method.

Acceptance criteria:
- `kanbn_rename_task` tool accepts taskId and newName
- Renames the task file and updates all index references
- Returns the new task ID (may change if name is part of ID)
- Moving task to a column is optional (position param)

## Sub-tasks

- [ ] Implement `kanbn_rename_task` tool with taskId, newName, optional column/position params
- [ ] Unit tests — happy paths (rename existing task, verify file renamed and index updated)
- [ ] Unit tests — sad paths (non-existent task, empty name, duplicate name)

## History

- type: created
  date: 2026-09-12T05:00:49.163Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
