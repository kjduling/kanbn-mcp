---
created: 2026-09-07T18:00:58.224Z
updated: 2026-09-10T04:58:18.783Z
---

# Add required fields to kanbn_create_task tool schema

The `kanbn_create_task` tool declares `name` and `description` as properties but does not include them in a `required` array. The `kanbn_move_task` tool does have `required`, which is good — the others should follow suit.

Without `required` fields, LLM callers may omit essential parameters and produce broken or empty tasks.

**Required fix:**
- Add a `required` array to `kanbn_create_task` with at least `name`
- Review all other tool schemas and add `required` fields where appropriate
- Ensure the tool description clearly states which fields are required vs optional

## Sub-tasks

- [ ] Create a unit test to verify

## History

- type: created
  date: 2026-09-07T18:00:58.224Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
