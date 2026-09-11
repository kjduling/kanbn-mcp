---
created: 2026-09-06T20:33:47.289Z
updated: 2026-09-11T00:21:54.206Z
assigned: Kevin
progress: 1
tags:
  - mcp-tool
  - kanbn-wrapper
  - feature
started: 2026-09-10T07:00:00.000Z
completed: 2026-09-11T00:18:43.378Z
---

# kanbn_edit_task

Implement `kanbn_edit_task` MCP tool that edits an existing task's fields on the Kanbn board.

The tool should:
- Accept `taskId` (required) and `path` (optional) parameters
- Accept optional fields: name, description, assigned, due, started, completed, progress, plannedStart, plannedFinish, tags, subTasks, comments, metadata
- Call `kanbn.editTask(taskId, updatedFields)` to update the task
- Return the updated task object as JSON
- Handle the case where the task is not found (throw a clear error)
- Support optional `path` parameter to target a specific project directory

## Sub-tasks

- [x] Implement kanbn_edit_task tool definition in server.ts (inputSchema with taskId, optional update fields)
- [x] Implement handler function that calls kanbn.editTask(taskId, partialData) and returns JSON result
- [x] Add routing in the CallToolRequest handler to dispatch to kanbn_edit_task
- [x] Acceptance test: Create a task, edit some fields, verify changes persisted correctly
- [x] Unit test: Write unit test for kanbn_edit_task handler with mock Kanbn instance
- [x] Acceptance test: Verify error is thrown when editing a non-existent task

## History

- type: created
  date: 2026-09-06T20:33:47.289Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-11T00:18:43.378Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
- type: progress
  date: 2026-09-11T00:21:54.201Z
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
