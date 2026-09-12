---
created: 2026-09-12T05:02:26.170Z
---

# kanbn-column-sort — sort a column

Implement MCP tool for kanbn library `sort(columnName, sorters, save)` method.

Acceptance criteria:
- `kanbn_sort_column` tool accepts columnName, sorters array, and optional save flag
- Sorters support fields: name, created, modified, due, assigned, progress
- Sort order: ascending/descending per field
- `save: true` persists the sort order to the index
- Returns the reordered column task list

## Sub-tasks

- [ ] Implement `kanbn_sort_column` tool with columnName, sorters, save params
- [ ] Unit tests — happy paths (sort by name asc, sort by due desc, multi-field sort)
- [ ] Unit tests — sad paths (invalid column, invalid sort field, invalid sort order)

## History

- type: created
  date: 2026-09-12T05:02:26.170Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
