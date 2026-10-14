---
tags:
  - bug
  - medium
created: 2026-10-14T02:58:34.063Z
---

# Task descriptions can hijack reserved sections when they embed a level-2 '## Sub-tasks' heading

A task description that contains a level-2 heading equal to a reserved section name — `## Sub-tasks`, `## Relations`, `## Comments` or `## History` — is hijacked when the task file is re-read: the heading is treated as that reserved section, so the description is silently truncated at that point and the lines that follow are re-parsed as sub-tasks/relations/comments/history.

Root cause: `getReservedSection()` in node_modules/@basementuniverse/kanbn/src/parse-task.js (lines 20-22) returns a section whenever `task[title]` exists with a `/^## /` heading, regardless of where in the file the heading sits. There is no escaping and no positional check.

Symptoms: the description loses everything from the heading onward; if the following lines are not a Markdown list the parse throws `sub-tasks must contain a list`. A description that legitimately documents the format (e.g. a ticket about sub-tasks) trips this. Found while drafting the sub-task data-loss ticket's description, which included a literal level-2 Sub-tasks example — the description was truncated and the example checklist was absorbed into the real sub-tasks section.

Note: only level-2 headings are reserved. A level-1 Comments heading and a level-3 Sub-tasks heading are description content and round-trip safely.

## Sub-tasks

- [ ] Decide the mitigation: reject a description containing a level-2 reserved heading with an actionable error, or escape/normalise it, or document the constraint as guidance only
- [ ] Implement the chosen guard in the description path (src/kanbn/taskData.ts) so kanbn_create_task and kanbn_edit_task surface a clear error instead of silently truncating
- [ ] Update the setup guidance (src/setup/guidance.ts) to warn clients off level-2 reserved headings in descriptions
- [ ] Verify a description containing a level-2 Sub-tasks heading is never silently truncated - it either round-trips intact or is rejected with an actionable error
- [ ] Verify ordinary descriptions containing a level-3 Sub-tasks heading or a level-1 Comments heading still round-trip unchanged
- [ ] Add a regression test: create with a description containing a level-2 Sub-tasks heading does not silently lose text
- [ ] Add a test: a description containing a level-3 Sub-tasks heading round-trips intact

## History

- type: created
  date: 2026-10-14T02:58:34.063Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
