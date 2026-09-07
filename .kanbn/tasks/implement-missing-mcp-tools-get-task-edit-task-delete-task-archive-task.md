---
created: 2026-09-07T18:00:58.113Z
updated: 2026-09-07T18:34:47.066Z
---

# Implement missing MCP tools: getTask, editTask, deleteTask, archiveTask

The `kanbn.d.ts` type definition declares four Kanbn methods that have no corresponding MCP tool implementations:

- `getTask` — retrieve a task by ID
- `editTask` — modify an existing task
- `deleteTask` — delete a task
- `archiveTask` — archive a task

The `TOOLS` array in `server.ts` only lists 6 tools, none of which cover these operations. If someone (or some LLM) sees those types and assumes the tools are implemented, they'll be in for a rude surprise.

**Required fix:**
- Add `kanbn_get_task`, `kanbn_edit_task`, `kanbn_delete_task`, `kanbn_archive_task` to the `TOOLS` array
- Implement corresponding handler functions in `server.ts` following the existing patterns
- Add corresponding entries to the `handleToolCall` switch statement
- Ensure the `kanbn.d.ts` declarations match the implemented tool signatures

## Sub-tasks

- [ ] undefined
- [ ] undefined
- [ ] undefined
- [ ] undefined
- [ ] undefined
- [ ] undefined

## Relations

- [Duplicates kanbn-get-task](kanbn-get-task.md)
- [Duplicates kanbn-edit-task](kanbn-edit-task.md)
- [Duplicates kanbn-archive-task](kanbn-archive-task.md)
- [Duplicates kanbn-delete-task](kanbn-delete-task.md)

## History

- type: created
  date: 2026-09-07T18:00:58.113Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
