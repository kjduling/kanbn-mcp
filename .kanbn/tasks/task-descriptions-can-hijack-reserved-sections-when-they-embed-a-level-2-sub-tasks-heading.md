---
progress: 1
tags:
  - bug
  - medium
created: 2026-10-14T02:58:34.063Z
updated: 2026-10-14T03:52:52.207Z
started: 2026-10-14T03:48:32.566Z
completed: 2026-10-14T03:52:52.146Z
---

# Task descriptions can hijack reserved sections when they embed a level-2 '## Sub-tasks' heading

A task description that contains a level-2 heading equal to a reserved section name — `## Sub-tasks`, `## Relations`, `## Comments` or `## History` — is hijacked when the task file is re-read: the heading is treated as that reserved section, so the description is silently truncated at that point and the lines that follow are re-parsed as sub-tasks/relations/comments/history.

Root cause: `getReservedSection()` in node_modules/@basementuniverse/kanbn/src/parse-task.js (lines 20-22) returns a section whenever `task[title]` exists with a `/^## /` heading, regardless of where in the file the heading sits. There is no escaping and no positional check.

Symptoms: the description loses everything from the heading onward; if the following lines are not a Markdown list the parse throws `sub-tasks must contain a list`. A description that legitimately documents the format (e.g. a ticket about sub-tasks) trips this. Found while drafting the sub-task data-loss ticket's description, which included a literal level-2 Sub-tasks example — the description was truncated and the example checklist was absorbed into the real sub-tasks section.

Note: only level-2 headings are reserved. A level-1 Comments heading and a level-3 Sub-tasks heading are description content and round-trip safely.

## Decision

Reject with an actionable error (chosen over escaping the heading or documenting it as guidance only: the format has no escaping, so an honest refusal beats silently corrupting the task).

`assertDescriptionHasNoReservedHeadings()` in src/kanbn/taskData.ts runs on both kanbn_create_task and kanbn_edit_task. It scans the description for an unfenced level-2 heading whose exact title is a reserved section name, using the same fence-tracking logic as kanbn's findHeadings, so a heading shown inside a fenced code block stays legal and the format can still be documented.

`Metadata` is included as a reserved title alongside the four named above, because the parser hijacks `## Metadata` the same way (it parses the following block as embedded front matter). Escape hatch for callers: demote the heading to level 3 or wrap it in a fenced code block.

## Sub-tasks

- [x] Decide the mitigation: reject a description containing a level-2 reserved heading with an actionable error, or escape/normalise it, or document the constraint as guidance only
- [x] Implement the chosen guard in the description path (src/kanbn/taskData.ts) so kanbn_create_task and kanbn_edit_task surface a clear error instead of silently truncating
- [x] Update the setup guidance (src/setup/guidance.ts) to warn clients off level-2 reserved headings in descriptions
- [x] Verify a description containing a level-2 Sub-tasks heading is never silently truncated - it either round-trips intact or is rejected with an actionable error
- [x] Verify ordinary descriptions containing a level-3 Sub-tasks heading or a level-1 Comments heading still round-trip unchanged
- [x] Add a regression test: create with a description containing a level-2 Sub-tasks heading does not silently lose text
- [x] Add a test: a description containing a level-3 Sub-tasks heading round-trips intact

## History

- type: created
  date: 2026-10-14T02:58:34.063Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-10-14T03:48:32.566Z
  fromColumn: Backlog
  toColumn: In Progress
  author: Kevin J. Duling
- type: progress
  date: 2026-10-14T03:52:52.092Z
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
- type: moved
  date: 2026-10-14T03:52:52.146Z
  fromColumn: In Progress
  toColumn: Done
  author: Kevin J. Duling
