---
board: index
tags:
  - bug
  - high
created: 2026-10-13T22:38:46.228Z
updated: 2026-10-13T23:45:10.684Z
started: 2026-10-13T23:42:24.632Z
completed: 2026-10-13T23:45:10.684Z
---

# kanbn_edit_task should give actionable error when task file is unparseable

When a task file fails to parse, kanbn_edit_task throws 'Task name cannot be blank' because the getTask() call fails, mergeExistingTaskData cannot backfill name, and the update rejects. This prevents repairing the corrupted file.

Fix: detect parse/load failures when reading existing task in edit path; re-throw with a clear, actionable message that names the task and the parse failure (or include the underlying error). Do not silently proceed.

## Sub-tasks

- [x] In edit_task, catch getTask errors and if it's a parse/load error, throw an improved error message
- [x] Distinguish 'task not found' from 'task file unparseable' where possible
- [x] Add regression test for unparseable task file edit attempt

## History

- type: moved
  date: 2026-10-13T23:45:10.684Z
  fromColumn: In Progress
  toColumn: Done
  author: Kevin J. Duling
