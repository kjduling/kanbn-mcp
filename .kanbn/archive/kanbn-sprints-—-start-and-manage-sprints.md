---
created: 2026-09-12T05:03:07.946Z
updated: 2026-09-13T20:25:56.668Z
completed: 2026-09-13T20:25:56.668Z
column: Done
---

# kanbn-sprints — start and manage sprints

Implement MCP tool for kanbn library `sprint(name, description, start)` method.

Acceptance criteria:
- `kanbn_start_sprint` tool accepts name, description (optional), and start date
- Creates a new sprint in the board config
- Returns the created sprint object
- Sprint name must be unique (error on duplicate)

## Sub-tasks

- [x] Implement `kanbn_start_sprint` tool with name, description, start params
- [x] Unit tests — happy paths (create new sprint, verify returned sprint object)
- [x] Unit tests — sad paths (duplicate name, invalid date)

## Comments

- author: Jinx
  date: 2026-09-13T21:30:00.000Z
  Implemented kanbn_start_sprint (path, optional name/description/start ISO; start defaults to now, blank name auto-generates 'Sprint N'). Handler validates start date (Invalid date: "<value>"), enforces sprint-name uniqueness across options.sprints and ownOptions.sprints (Sprint "<name>" already exists — the lib itself does not check), then calls instance.sprint and returns the created sprint object (name, description, start, board). TOOLS entry, dispatch case, HELP_TEXT, README row, listTools entry added. 4 tests (164 → 168): create with name/desc/start and verify persisted to index.options.sprints, auto-generated name, duplicate name rejection, invalid date rejection. 168/168 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T20:25:56.668Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T21:49:01.679Z
  fromColumn: Done
  author: Kevin J. Duling
