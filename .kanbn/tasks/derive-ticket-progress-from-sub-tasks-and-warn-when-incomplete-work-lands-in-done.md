---
tags:
  - feature
  - high
progress: 1
created: 2026-10-14T03:16:17.868Z
updated: 2026-10-14T03:16:32.800Z
completed: 2026-10-14T03:16:28.582Z
---

# Derive ticket progress from sub-tasks and warn when incomplete work lands in Done

Tickets were turning up in the Done column with no progress recorded (0%). Two gaps: nothing computed progress at all, and nothing nudged when an unfinished ticket was parked in Done.

Behaviour now: progress is derived, never typed. A ticket with sub-tasks is complete to the fraction ticked; a ticket with no sub-tasks is 0% while open and 100% once it sits in a completed column (index.options.completedColumns, default Done). kanbn_create_task, kanbn_edit_task, kanbn_move_task and kanbn_rename_task recompute it on every write, so the field cannot drift from reality. Moving an incomplete ticket into a completed column still succeeds, but the response carries a warning naming the completed/total sub-tasks. An explicitly supplied progress that disagrees with the derived value is replaced, and the response says so - no silent override.

Decision: warn-only (no hard gate on the move). 'Done requires passing unit tests' is not machine-checkable, so that rule is guidance-only, stated in the SKILL and the managed board guidance.

Note: getTask does not hydrate the column (that is hydrateTask), so the resync path asks instance.findTaskColumn instead.

## Sub-tasks

- [x] Add src/kanbn/progress.ts: deriveProgress, roundProgress, getCompletedColumns, isCompletedColumn, applyDerivedProgress, progressWarning, progressOverrideNote
- [x] Wire kanbn_create_task and kanbn_edit_task to apply derived progress, and warn when a ticket rests in a completed column while incomplete
- [x] Wire kanbn_move_task and kanbn_rename_task to resync progress for the target column (via instance.findTaskColumn, since getTask does not hydrate column)
- [x] Add a Progress and completion section to src/setup/guidance.ts and regenerate skills/kanbn/SKILL.md
- [x] Add unit tests for deriveProgress (sub-task ratio, 1/3 rounding, no-sub-task column rule) and the note/warning copy
- [x] Add integration tests: create derives from sub-tasks; ticking sub-tasks updates progress; moving a sub-task-less ticket into Done completes it; moving it back out un-completes it; moving an incomplete ticket into Done warns and leaves the true progress
- [x] Verify a caller-supplied progress that disagrees with the derived value is replaced and reported, never silently overridden
- [x] Backfill the four Done tickets that had no progress so every Done ticket reads 100%
- [x] Verify: full suite green (270 tests / 48 suites) and npm run build clean

## Relations

- [related-to kanbn-edit-task-silently-wipes-sub-task-text-when-sub-tasks-entries-omit-text](kanbn-edit-task-silently-wipes-sub-task-text-when-sub-tasks-entries-omit-text.md)
