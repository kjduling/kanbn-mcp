---
created: 2026-09-12T05:03:54.253Z
---

# kanbn-burndown — burndown chart data

Implement MCP tool for kanbn library `burndown(sprints, dates, assigned, columns, normalise)` method.

Acceptance criteria:
- `kanbn_burndown` tool accepts optional params: sprints, dates, assigned, columns, normalise
- Returns burndown chart data as an object
- Default (no params) returns current sprint burndown
- Filtering by assigned user works correctly
- Filtering by columns works correctly

## Sub-tasks

- [ ] Implement `kanbn_burndown` tool with all optional params
- [ ] Unit tests — happy paths (current sprint, named sprint, filtered by user, filtered by columns)
- [ ] Unit tests — sad paths (non-existent sprint, invalid date range)

## History

- type: created
  date: 2026-09-12T05:03:54.253Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
