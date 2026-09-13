---
created: 2026-09-12T05:00:08.848Z
updated: 2026-09-13T19:43:27.487Z
completed: 2026-09-13T19:43:27.487Z
column: Done
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

- [x] Implement `kanbn_search` tool with filters and quiet params
- [x] Unit tests — happy paths (search by tag, by assigned, by due date, no filters)
- [x] Unit tests — sad paths (invalid filter schema, non-existent filter values)

## Comments

- author: Jinx
  date: 2026-09-13T06:00:00.000Z
  Implemented kanbn_search as a thin wrapper over the lib search() method. Validates the 27 built-in filter keys (string/regex, date/range, number/range, boolean) plus any configured custom fields, throwing clear errors on unknown keys or wrong value types. quiet:true returns task IDs only; empty filters return all tasks across every column. Added handler + TOOLS entry + dispatch case + HELP_TEXT + README row. 8 tests: no filters (across Backlog/In Progress/Done), tag, assigned, due date, quiet IDs-only, unknown key, wrong type, empty result. 136/136 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T19:43:27.487Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T21:48:46.164Z
  fromColumn: Done
  author: Kevin J. Duling
