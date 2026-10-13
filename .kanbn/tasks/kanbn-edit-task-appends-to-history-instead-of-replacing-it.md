---
progress: 1
tags:
  - bug
  - high
created: 2026-10-13T22:38:46.216Z
updated: 2026-10-13T23:32:23.054Z
started: 2026-10-13T22:39:29.504Z
completed: 2026-10-13T22:55:14.598Z
---

# kanbn_edit_task appends to History instead of replacing it

kanbn_edit_task currently replaces the History section instead of appending to it. A single edit wipes prior history events (created/moved) and leaves only the new event. This causes silent audit-trail data loss.

The fix is to treat history the same as relations/subTasks/comments in mergeExistingTaskData: when the caller does not supply history, preserve existing history from the task file.

## Sub-tasks

- [x] Add 'history' to EDIT_COLLECTION_KEYS in src/kanbn/taskData.ts
- [x] Add 'history' to topLevelKeys in buildTaskDataFromArgs so history can be passed through
- [x] Add regression test asserting history is preserved across partial edits
- [x] Add regression test asserting explicit history replacement still works
