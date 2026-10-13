---
tags:
  - bug
  - high
assigned: 'Kevin J. Duling'
created: 2026-10-01T17:33:32.467Z
updated: 2026-10-13T22:01:04.016Z
---

# Fix three kanbn-mcp bugs: edit_task replaces History instead of appending, edit_task cannot repair an unparseable task file, and init_board requires the documented-optional columns

Three defects found while verifying kanbn-mcp against opencode by exercising 55 of its 65 tools against real boards. All three reproduce deterministically. #2 is the serious one: silent audit-trail data loss.

## 1. kanbn_edit_task REPLACES the History section instead of appending (data loss)

A single edit wipes prior history events and leaves only the new one.

Repro (throwaway copy of this repo's own board, task add-first-class-task-relation-tools-add-remove-set-relations):

    kanbn_edit_task({ taskId: 'add-first-class-task-relation-tools-add-remove-set-relations', progress: 0.9 })

History went from 2 events (created, moved) to 1 (progress). The diff shows the `created` and `moved` events deleted outright. In a second case on a task whose only event was `moved`, the entire `## History` section was removed including its heading.

This is an append-vs-replace bug. Every other collection (subTasks, comments, relations) has documented replace semantics and is guarded by the comment at src/tools/task.ts:169-172 about merge-back; History must not inherit that. Observed live on this board's support-mcp-as-a-positional-argument task, where a throwaway `due` edit deleted the only `moved` event. Reverted with git checkout.

## 2. kanbn_edit_task cannot repair a task whose file fails to parse (chicken-and-egg)

When a task file is malformed, edit_task throws `Task name cannot be blank`, so you cannot use the tool to fix the very corruption it reports.

Chain, per src/tools/task.ts:164-178:
- getTask throws on the unparseable file
- the catch at line 175 swallows it and proceeds
- mergeExistingTaskData therefore cannot backfill the existing name
- the library's update then rejects the nameless task with "Task name cannot be blank"

Hit for real on the Alice board: .kanbn/tasks/implement-missing-server-functions-*.md had an empty `## Sub-tasks` heading, so kanbn_search, kanbn_burndown and non-quiet kanbn_status all failed board-wide with "sub-tasks must contain a list". kanbn_validate_board reported it correctly, but the obvious recovery move, `kanbn_edit_task` to rewrite the sub-tasks, was impossible and the file had to be hand-edited.

Note: this does NOT mean name is generally required in edit_task. On a healthy task `kanbn_edit_task({ taskId, due })` with no name works fine. It is specifically the merge-back failing that produces the misleading "name cannot be blank" message.

## 3. kanbn_init_board / kanbn_initialize_board crash when columns is omitted (documented optional)

`columns` is optional in both tool schemas but omitting it always fails.

    columns only          -> OK
    name + columns        -> OK
    columns: []           -> OK
    name only             -> Cannot read properties of undefined (reading 'map')
    neither               -> Cannot use 'in' operator to search for 'name' in Project Board

Root cause is src/tools/board.ts:85:

    const columns = Array.isArray(args.columns) ? args.columns : undefined;

That explicit `undefined` is then passed at line 95. The library dereferences it. The second attempt at line 99, `initFn.call(instance, boardName, columns)`, passes a bare string positionally, which is what produces the confusing `'name' in "Project Board"` message - the library takes an options object, so the positional retry can never work and only masks the real error.

Workaround today: always pass `columns`, even `[]`.

## Acceptance criteria

- `kanbn_edit_task` appends to History; a task with N prior events still has N after any edit.
- An edit on an unparseable task file produces an actionable error naming the parse failure, not "Task name cannot be blank".
- `kanbn_init_board({ path })` with no args succeeds using library default columns.
- Regression tests for all three, plus a test asserting History is never truncated by a partial edit.

## Context

Found while auditing kanbn-mcp from opencode. Bugs 2 and 3 are arg-forwarding shapes; bug 1 is a genuine correctness regression in a write path that agents use constantly.

## Sub-tasks

- [ ] Fix edit_task so it appends to the History section rather than replacing it - guard History the same way subTasks/comments/relations are handled in src/tools/task.ts.
- [ ] Fix edit_task so a task file that fails to parse yields an actionable parse error instead of the misleading 'Task name cannot be blank' thrown when mergeExistingTaskData cannot backfill the name.
- [ ] Fix init_board so omitting the documented-optional columns arg works, by defaulting to the library's default columns instead of passing explicit undefined (src/tools/board.ts:85).
- [ ] Remove or fix the positional-retry fallback at src/tools/board.ts:99, which can never succeed and replaces the real error with a confusing one.
- [ ] Add regression tests for History append-on-edit, the unparseable-task error message, and columns-less init_board.
