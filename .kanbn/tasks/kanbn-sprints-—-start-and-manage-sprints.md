---
created: 2026-09-12T05:03:07.946Z
---

# kanbn-sprints — start and manage sprints

Implement MCP tool for kanbn library `sprint(name, description, start)` method.

Acceptance criteria:
- `kanbn_start_sprint` tool accepts name, description (optional), and start date
- Creates a new sprint in the board config
- Returns the created sprint object
- Sprint name must be unique (error on duplicate)

## Sub-tasks

- [ ] Implement `kanbn_start_sprint` tool with name, description, start params
- [ ] Unit tests — happy paths (create new sprint, verify returned sprint object)
- [ ] Unit tests — sad paths (duplicate name, invalid date)

## History

- type: created
  date: 2026-09-12T05:03:07.946Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
