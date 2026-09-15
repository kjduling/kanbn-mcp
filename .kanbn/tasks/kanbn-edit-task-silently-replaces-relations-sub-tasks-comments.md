---
created: 2026-09-14T23:25:02.023Z
updated: 2026-09-15T21:39:06.049Z
completed: 2026-09-15T21:39:06.049Z
---

# kanbn_edit_task silently replaces relations/subTasks/comments

BUG: kanbn_edit_task silently DROPS un-supplied collections because the edit handler backfills name/description/metadata from the existing task but NOT relations, subTasks or comments. Passing any of those fields replaces the whole collection, so a casual "add one relation" edit wipes the existing dependency graph with no warning. This is a real deviation in our layer: the handler clearly tries to be non-destructive (task.ts:164-188 copies existing name/description/metadata into taskData) yet leaves the top-level collections unprotected.

Root cause:
- handleKanbnEditTask (src/tools/task.ts) only backfills name, description and metadata before calling instance.updateTask.
- buildTaskDataFromArgs (src/kanbn/taskData.ts:64) maps relations/subTasks/comments straight into taskData.
- The underlying @basementuniverse/kanbn updateTask -> saveTask writes the whole task document, so relations/subTasks/comments are authoritative whole-array replaces (library semantics; NOT a library bug — the CLI manages them with read-edit-write loops). Since the MCP tool exposes them raw and undocumented, callers can't know they're destructive.

Verified reproduction (had to fix the damage it caused):
1. kanbn_edit_task on role-permission-management-ui-matrix-role-crud with relations [depends-on model] — ok.
2. A second kanbn_edit_task with relations [blocks admin-view-as] — SILENTLY replaced, dropping the depends-on from #1. get_task confirmed only the blocks edge remained. Required a third edit re-supplying the full array to repair.

Also surfaced related gaps (covered by task "Add first-class task relation tools (add/remove/set relations)"): relations isn't declared in the create/edit schemas so clients can't discover it.

Acceptance criteria:
- kanbn_edit_task must never clobber data the caller didn't mention: after the fix, editing relations (or subTasks/comments) without re-supplying all of them must preserve the rest, OR the tool must hard-error with an explicit "replace-all is destructive" message (prefer preserving).
- Backfill relations/subTasks/comments from the existing task exactly like name/description/metadata are today, so partial edits merge on the collections a caller touches... or, cleaner: a deliberate merge helper shared with the add/remove relation tools.
- Warning surfaced in the kanbn_edit_task description while the replace-all path exists.
- Regression test: reproduce the two-step edit above; assert the second edit no longer deletes the first.

Depends on: none (independent of the relation-tools feature task, but should be coordinated with it to avoid duelling implementations).
Likely files: src/tools/task.ts (backfill logic), src/kanbn/taskData.ts (collection handling), tests.

## Relations

- [related-to add-first-class-task-relation-tools-add-remove-set-relations](add-first-class-task-relation-tools-add-remove-set-relations.md)

## Comments

- author: Kevin J. Duling
  date: 2026-09-15T21:39:16.330Z
  Fixed. handleKanbnEditTask now merges via shared mergeExistingTaskData (src/kanbn/taskData.ts): it backfills relations/subTasks/comments from the existing task exactly like name/description/metadata, so an edit only replaces the collection(s) it explicitly mentions — unmentioned data survives. Supplying a collection is still replace-all for that collection (library semantics), surfaced by the schema description warning; use kanbn_add_relation/kanbn_remove_relation for merges. Regression test reproduces the two-step reproduction and asserts the second edit no longer clobbers the first. Suite: 196 pass, build clean.

## History

- type: moved
  date: 2026-09-15T21:39:06.049Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
