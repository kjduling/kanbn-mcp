---
created: 2026-09-12T05:00:08.848Z
---

# kanbn-task-search — search tasks with filters

Implement MCP tool for kanbn library `search(filters, quiet)` method.

Acceptance criteria:
- `kanbn_search` tool accepts filter object (e.g. by tag, assigned, due, status)
- When `quiet: true`, returns only task IDs
- When `quiet: false`, returns full task details
- Empty filters returns all tasks
- Invalid filters return a clear error
- Works across all columns on the board

## Sub-tasks

- [ ] Implement `kanbn_search` tool with filters and quiet params
- [ ] Unit tests — happy paths (search by tag, by assigned, by due date, no filters)
- [ ] Unit tests — sad paths (invalid filter schema, non-existent filter values)

## History

- type: created
  date: 2026-09-12T05:00:08.848Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
