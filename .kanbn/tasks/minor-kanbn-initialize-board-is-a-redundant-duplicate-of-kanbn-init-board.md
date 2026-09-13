---
created: 2026-09-10T04:37:04.433Z
updated: 2026-09-12T22:44:32.529Z
---

# MINOR: kanbn_initialize_board is a redundant duplicate of kanbn_init_board

## Problem

`kanbn_initialize_board` exists as an exact duplicate of `kanbn_init_board`:
- Same schema
- Same handler (`handleKanbnInitBoard`)
- Same description

It exists as an alias for MCP client convenience, but it inflates the tool list without adding value.

## Risk

- Tool list is unnecessarily larger
- Clients may call either tool and get confusing results about which is "canonical"
- Increases maintenance burden (changes to one must be mirrored to the other)

## Acceptance Criteria

- [ ] Decide whether the alias serves a documented MCP client compatibility purpose
- [ ] If kept, add a clear comment in the schema explaining the alias
- [ ] If removed, document which tool is the canonical one
- [ ] Unit test verifies the remaining tool works correctly

## Sub-tasks

- [ ] Add comment to alias schema explaining MCP client compatibility purpose
- [ ] Or remove alias and document canonical tool name
- [ ] Verify remaining canonical tool works in unit test

## History

- type: created
  date: 2026-09-10T04:37:04.433Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-12T22:44:32.529Z
  fromColumn: Backlog
  toColumn: Todo
  author: Kevin J. Duling
