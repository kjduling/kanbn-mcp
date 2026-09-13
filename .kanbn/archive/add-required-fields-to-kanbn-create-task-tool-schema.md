---
created: 2026-09-07T18:00:58.224Z
updated: 2026-09-13T20:09:03.455Z
completed: 2026-09-13T20:09:03.455Z
column: Done
---

# Add required fields to kanbn_create_task tool schema

The `kanbn_create_task` tool declares `name` and `description` as properties but does not include them in a `required` array. The `kanbn_move_task` tool does have `required`, which is good — the others should follow suit.

Without `required` fields, LLM callers may omit essential parameters and produce broken or empty tasks.

**Required fix:**
- Add a `required` array to `kanbn_create_task` with at least `name`
- Review all other tool schemas and add `required` fields where appropriate
- Ensure the tool description clearly states which fields are required vs optional

## Sub-tasks

- [x] Create a unit test to verify

## Comments

- author: Jinx
  date: 2026-09-13T20:10:00.000Z
  Added required: ["name"] to the kanbn_create_task input schema and updated its description to state name is required, all other fields optional. Audited all 49 tool schemas against the 27 handler-level 'Missing required parameter' throws: every throwing tool already declared an appropriate required array (kanbn_board_exists already required slug), and the remaining tools without required are genuinely all-optional — so no other schema changes were needed. 2 new tests asserting the required arrays. 156/156 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T20:09:03.455Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T21:48:52.536Z
  fromColumn: Done
  author: Kevin J. Duling
