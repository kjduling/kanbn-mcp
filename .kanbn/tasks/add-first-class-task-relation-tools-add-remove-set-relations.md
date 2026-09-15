---
created: 2026-09-14T23:22:05.684Z
updated: 2026-09-15T21:39:05.746Z
completed: 2026-09-15T21:39:05.746Z
---

# Add first-class task relation tools (add/remove/set relations)

Expose task RELATION management as first-class MCP tools. The underlying kanbn library already supports relations fully (per-task `{task, type}[]`, types normalised to kebab-case like `depends-on` / `blocks`, persisted to task files and rendered as `## Relations` links, and filterable in `kanbn_search` via `relation` + `count-relations`), but the MCP server never declares them in any tool schema.

Verified empirically (throwaway board): relations can be written today by passing a top-level `relations` array (or `taskData.relations`) to `kanbn_create_task` / `kanbn_edit_task`, because `buildTaskDataFromArgs()` (src/kanbn/taskData.ts:64) treats `relations` as a recognised top-level key. `kanbn_edit_task` replaces the whole array, it does NOT merge (confirmed). This works but is undocumented and fragile.

Deliverables:
- Declare `relations` (array of `{ task: string, type: string }`) in the `kanbn_create_task` and `kanbn_edit_task` input schemas (src/tools/task.ts) so clients see it and the description mentions replace semantics on edit.
- New dedicated tool(s), e.g.:
  - `kanbn_add_relation` (taskId, task, type) — read current relations, append if not already present, write back via editTask/updateTask.
  - `kanbn_remove_relation` (taskId, task, type?) — drop matching relations.
  - `kanbn_set_relations` (taskId, relations) — authoritative replace-all (edit path /pin.js behaviour as fallback).
- Handle normalisation (reuse kanbn's relation types; pass through as-is is fine since the library normalises) and empty-array clears.
- Relation targets should be validated to exist where cheap (getTask the target) with a clear error mirroring kanbn's "depends on missing task" behaviour.

Acceptance criteria:
- Create a task with relations, then get_task returns them; task file shows `## Relations` links.
- edit without relations leaves existing relations untouched (add_relation/remove_relation are the merge-focused tools).
- remove_relation clears a single link; set_relations with [] clears all.
- Tests: unit (taskData mapping, merge helpers) + a smoke test against a temp board like the manual one used to confirm current behaviour.

Context: discovered while wiring a depends-on / blocks chain on the Museum board (/Users/kevin/Dev/Museum). The two confirmed tools (`kanbn_create_task`, `kanbn_edit_task`) already persist relations; this ticket formalises and extends them.

## Comments

- author: Kevin J. Duling
  date: 2026-09-15T21:39:15.027Z
  Done. `relations` ({task, type}[]) now declared in kanbn_create_task and kanbn_edit_task schemas (RELATIONS_PROPERTY, src/kanbn/schema.ts), with replace-all warning on edit. New tools: kanbn_add_relation (merge-append w/ normalised dedup + target validation), kanbn_remove_relation (drop one edge or all to a task), kanbn_set_relations (authoritative replace; [] clears). Shared merge helper mergeExistingTaskData in src/kanbn/taskData.ts powers all of it. Tests: 5 new cases (mapping unit, merge helper, normalisation, create+links smoke, add/remove/set smoke) — full suite 196 pass.

## History

- type: created
  date: 2026-09-14T23:22:05.684Z
  column: Todo
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-15T21:39:05.746Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
