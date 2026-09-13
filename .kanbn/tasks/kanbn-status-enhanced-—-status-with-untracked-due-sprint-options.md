---
created: 2026-09-12T05:01:41.427Z
updated: 2026-09-13T20:38:41.851Z
completed: 2026-09-13T20:38:41.851Z
---

# kanbn-status-enhanced — status with untracked/due/sprint options

Enhance `kanbn_status` to support kanbn library `status(quiet, untracked, due, sprint, dates)` method options.

Acceptance criteria:
- `kanbn_status` tool gains optional params: `quiet`, `untracked`, `due`, `sprint`, `dates`
- `quiet: true` returns partial status (task counts only)
- `untracked: true` includes list of untracked task files
- `due: true` shows overdue tasks and time remaining
- `sprint` param shows sprint stats for named/numbered sprint
- `dates` param filters by date range
- Default behaviour unchanged (backward compatible)

## Sub-tasks

- [x] Add optional status params to `kanbn_status` tool schema
- [x] Wire params to kanbn.status() call in handler
- [x] Unit tests — happy paths (quiet mode, untracked, due, sprint, dates)
- [x] Unit tests — sad paths (invalid sprint name, invalid date format)

## Comments

- author: Jinx
  date: 2026-09-13T22:30:00.000Z
  kanbn_status now accepts optional quiet, untracked, due, sprint, dates params (schema added). When any are provided the handler calls instance.status(quiet, untracked, due, sprint, dates) and feeds the result through the same pretty→compact→truncate size-limit pipeline; with no params it returns the raw index exactly as before (backward compatible). dates coerced to an array of validated ISO dates (Invalid date: "<value>"), sprint passed through as string/number, lib errors wrapped as Failed to get status. 6 tests (168 → 174): quiet+untracked filename array, overdue tasks via edit_task due, named sprint stats, date-range period filter, unknown sprint name, invalid date.

## History

- type: moved
  date: 2026-09-13T20:38:41.851Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
