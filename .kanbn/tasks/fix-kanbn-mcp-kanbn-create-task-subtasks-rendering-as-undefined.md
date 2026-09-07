---
created: 2026-09-07T18:19:25.844Z
updated: 2026-09-07T21:47:45.352Z
assigned: Kevin
progress: 0.95
tags:
  - Bug
  - Regression
  - 'High Priority'
started: 2026-09-07T21:13:00.427Z
completed: 2026-09-07T07:00:00.000Z
---

# Fix kanbn_mcp_kanbn_create_task subtasks rendering as 'undefined'

**Bug:** When creating tasks via the `kanbn_mcp_kanbn_create_task` tool with subtasks provided in the `subTasks` parameter, each subtask's text renders as the literal string `undefined` instead of the actual subtask name/description.

**Reproduction:** Call `kanbn_mcp_kanbn_create_task` with a `subTasks` array containing objects with a `name` property. The resulting subtasks in the board show "undefined" as their text.

**Impact:** Any task creation via the MCP tool that relies on subtasks loses all useful information. All 11 tasks created in the previous review session are affected.

**Suspected cause:** The MCP tool's `kanbn_mcp_kanbn_create_task` implementation likely doesn't correctly map the `name` field from the `subTasks` input objects to the underlying Kanbn task subtask representation.

**Note:** Do NOT add subtasks to this task — the bug prevents them from rendering correctly.

## Sub-tasks

- [x] Create a unit test to verify

## History

- type: created
  date: 2026-09-07T18:19:25.844Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-07T18:32:14.178Z
  fromColumn: Todo
  toColumn: Backlog
  author: Kevin J. Duling
- type: moved
  date: 2026-09-07T21:13:00.427Z
  fromColumn: Backlog
  toColumn: In Progress
  author: Kevin J. Duling
- type: progress
  date: 2026-09-07T21:13:57.162Z
  fromProgress: 0
  toProgress: 0.95
  author: Kevin J. Duling
- type: moved
  date: 2026-09-07T21:47:45.352Z
  fromColumn: In Progress
  toColumn: Done
  author: Kevin J. Duling
