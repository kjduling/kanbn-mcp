---
created: 2026-09-12T05:02:26.170Z
updated: 2026-09-13T16:16:49.476Z
completed: 2026-09-13T16:16:49.476Z
column: Done
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

- [x] Implement kanbn_sort_column tool with columnName, sorters, save params
- [x] Unit tests — happy paths (sort by name asc, sort by due desc, multi-field sort)
- [x] Unit tests — sad paths (invalid column, invalid sort field, invalid sort order)

## Comments

- author: Jinx
  date: 2026-09-13T01:40:00.000Z
  kanbn_sort_column implemented: accepts columnName, sorters array (field/order/filter), optional save flag. Fields validated: name, created, modified, due, assigned, progress — lib maps modified→updated internally. Lib sort() returns void; handler reloads index to return the reordered task-id array. save:true persists sorters into index.options.columnSorting and the lib re-sorts on every subsequent save. 97/97 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T16:16:49.476Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T16:55:54.884Z
  fromColumn: Done
  author: Kevin J. Duling
