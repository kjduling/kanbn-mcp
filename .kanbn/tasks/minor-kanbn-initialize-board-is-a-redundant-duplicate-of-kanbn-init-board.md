---
created: 2026-09-10T04:37:04.433Z
updated: 2026-09-13T16:45:21.397Z
completed: 2026-09-13T16:45:21.397Z
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

- [x] Add comment to alias schema explaining MCP client compatibility purpose
- [x] Or remove alias and document canonical tool name
- [x] Verify remaining canonical tool works in unit test

## Comments

- author: Jinx
  date: 2026-09-13T04:00:00.000Z
  Decision: KEEP the alias (removing a public MCP tool would break clients that registered kanbn_initialize_board). Added a schema comment marking it a deliberate alias for kanbn_init_board (canonical) for MCP client compatibility, noting to keep entry/dispatch/handler in sync; dispatch case annotated too. New parity test: kanbn_initialize_board initializes a board identically to kanbn_init_board (existing canonical test still passes). 107/107 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T16:45:21.397Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
