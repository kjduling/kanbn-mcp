---
created: 2026-09-12T05:01:41.427Z
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

- [ ] Add optional status params to `kanbn_status` tool schema
- [ ] Wire params to kanbn.status() call in handler
- [ ] Unit tests — happy paths (quiet mode, untracked, due, sprint, dates)
- [ ] Unit tests — sad paths (invalid sprint name, invalid date format)

## History

- type: created
  date: 2026-09-12T05:01:41.427Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
