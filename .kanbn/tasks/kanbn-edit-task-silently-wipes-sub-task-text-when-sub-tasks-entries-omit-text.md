---
progress: 1
tags:
  - bug
  - critical
created: 2026-10-14T02:40:52.378Z
updated: 2026-10-14T03:13:17.666Z
started: 2026-10-14T02:45:27.953Z
completed: 2026-10-14T02:48:03.629Z
---

# kanbn_edit_task silently wipes sub-task text when subTasks entries omit text

kanbn_edit_task silently destroys sub-task text when a caller supplies subTasks entries that omit `text` — e.g. an array of {completed:true} objects sent to tick items off by position. The entire collection is replaced with empty-text entries and every original sub-task title is lost. No error is raised.

Payload that triggered it (another LLM closing out a ticket): { taskId, path, subTasks: [{completed:true}, {completed:true}, ... , {completed:false}] } — nine entries, none with text.

Observable result — the sub-task titles are blanked and the entry count is taken from the supplied array length, so the rendered sub-tasks section collapses to blank checklist lines (ticked, ticked, unticked).

Reproduced on a scratch board: a task whose sub-tasks were "First sub-task" / "Second sub-task" / "Third sub-task", edited with three {completed:...} entries and no text, came back with empty text on every entry and the markdown reduced to blank checkboxes.

Root cause: buildTaskDataFromArgs (src/kanbn/taskData.ts) normalises each entry with `String(sub?.text ?? sub?.name ?? sub?.description ?? "")`, so a missing text silently becomes "". Because subTasks is in EDIT_COLLECTION_KEYS, mergeExistingTaskData (same file) treats any supplied subTasks array as an authoritative whole-collection replace and does not backfill the existing text; the library then writes the empty strings over the originals.

There is also a guidance gap: neither the kanbn SKILL.md nor the board guidance documents how to complete a sub-task. The only supported edit is a whole-collection replace, but nothing tells the caller that, so an LLM reasonably guesses a positional {completed:true} update — which the API does not support and which destroys data.

Expected: reject subTasks entries with no text (after normalisation) with an actionable error naming the offending index and explaining that sub-tasks are a whole-collection replace, so the full list (text + completed) must be supplied. Never silently blank existing sub-task text. Document the correct procedure in the skill and board guidance.

## Sub-tasks

- [x] Validate subTasks entries in kanbn_edit_task: reject any entry whose text is empty after normalisation, with an actionable error naming the index and explaining that sub-tasks replace as a whole collection
- [x] Apply the same validation to kanbn_create_task so an empty-text sub-task cannot be created either
- [x] Decide and implement safe sub-task completion: either reject text-less entries outright, or preserve existing text by index when an entry omits text. Document the chosen behaviour
- [x] Update skills/kanbn/SKILL.md and the managed board guidance so the only supported way to complete a sub-task (resend the full subTasks array with text + completed) is stated explicitly
- [x] Verify kanbn_edit_task with {completed:true} entries that have no text is rejected and leaves the task file unchanged
- [x] Verify editing with a full subTasks list (text + completed) still updates the completion flags
- [x] Verify existing sub-task text is never silently blanked under any edit
- [x] Add a regression test: edit with text-less sub-task entries throws and the task file is unchanged
- [x] Add a test: create with an empty-text sub-task entry throws
- [x] Add a test: a full-list sub-task edit updates only the completed flags and preserves every text

## Relations

- [related-to kanbn-edit-task-appends-to-history-instead-of-replacing-it](kanbn-edit-task-appends-to-history-instead-of-replacing-it.md)

## Comments

- author: Kevin J. Duling
  date: 2026-10-14T02:45:27.941Z
  Provenance (bisect): NOT a regression from today's history fix. The wipe needs two pre-existing ingredients in src/kanbn/taskData.ts: (1) the sub-task normaliser String(sub?.text ?? sub?.name ?? sub?.description ?? "") silently turns a missing text into "" — introduced with the file in 2ca63ff (2026-09-13); (2) subTasks in EDIT_COLLECTION_KEYS plus mergeExistingTaskData treating a supplied collection as an authoritative whole-collection replace — introduced in 497995c (2026-09-15). Today's history work (234fc44, 128d11c) only added "history" to the same preserve-list plus its date-mapping; it never touched sub-task handling. The bug is ~4 weeks old, so don't bisect against the history fix.
- author: Kevin J. Duling
  date: 2026-10-14T02:48:03.612Z
  Fixed. Added assertSubTasksHaveText (src/kanbn/taskData.ts) and called it from handleKanbnCreateTask and handleKanbnEditTask (src/tools/task.ts) right after buildTaskDataFromArgs, before any read/write. A sub-task entry with empty/whitespace-only text now throws: Invalid subTasks entry at index N: "text" is required... and nothing is written.
  
  Decision: reject text-less entries outright (chose NOT to index-merge completion, because a positional merge misattributes completion when the list is reordered or resized).
  
  Guidance: added the safe procedure to the setup guidance generator (src/setup/guidance.ts) and regenerated the committed skills/kanbn/SKILL.md.
  
  Tests: 7 new tests in tests/kanbn-mcp.test.ts covering the pure guard (rejects text-less / whitespace-only; accepts valid) and integration (edit with text-less entries leaves the task file byte-for-byte unchanged; create rejects; full-list edit updates only completion and preserves every text). Full suite: 257 tests / 46 suites, all pass. npm run build clean.
  
  Files: src/kanbn/taskData.ts, src/tools/task.ts, src/setup/guidance.ts, skills/kanbn/SKILL.md, tests/kanbn-mcp.test.ts. Not committed (user commits).

## History

- type: progress
  date: 2026-10-14T03:13:17.666Z
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
