---
created: 2026-09-12T05:03:54.253Z
updated: 2026-09-13T20:01:53.076Z
completed: 2026-09-13T20:01:53.076Z
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

- [x] Implement `kanbn_burndown` tool with all optional params
- [x] Unit tests — happy paths (current sprint, named sprint, filtered by user, filtered by columns)
- [x] Unit tests — sad paths (non-existent sprint, invalid date range)

## Comments

- author: Jinx
  date: 2026-09-13T06:30:00.000Z
  Implemented kanbn_burndown as a thin wrapper over the lib burndown(sprints, dates, assigned, columns, normalise) method. All params optional: sprints (names or 1-based numbers) default to the current sprint; dates define a range (handler validates each parses, rejecting invalid dates cleanly); assigned is an exact-user filter; columns a column-name filter; normalise is enum auto/days/hours/minutes/seconds with early rejection of unknown modes. Validates sprints/columns/assigned shapes, then wraps lib errors as 'Failed to get burndown data: <msg>'. Returns the full {series:[{sprint, from, to, dataPoints}]} chart as JSON (Dates auto-serialise to ISO). TOOLS entry, dispatch case, HELP_TEXT, README row all added. 8 tests: current sprint default, sprint by name & number, assigned filter, column filter, non-existent sprint number & name, invalid date, no startedColumns. 154/154 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T20:01:53.076Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
