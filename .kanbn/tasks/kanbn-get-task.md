---
tags:
  - mcp-tool
  - kanbn-wrapper
  - feature
created: 2026-09-06T20:33:47.256Z
updated: 2026-09-10T04:55:50.256Z
completed: 2026-09-10T04:55:50.256Z
---

# kanbn_get_task

Implement `kanbn_get_task` MCP tool that retrieves a task by its ID from the Kanbn board.

The tool should:
- Accept `taskId` (required) and `path` (optional) parameters
- Call `kanbn.getTask(taskId)` to fetch the task data
- Return the full task object as JSON (name, description, assigned, due, started, completed, progress, tags, subTasks, comments, etc.)
- Handle the case where the task is not found (throw a clear error)
- Support optional `path` parameter to target a specific project directory

## Sub-tasks

- [ ] Implement kanbn_get_task tool definition in server.ts (inputSchema with taskId, path)
- [ ] Implement handler function that calls kanbn.getTask(taskId) and returns JSON result
- [ ] Add routing in the CallToolRequest handler to dispatch to kanbn_get_task
- [ ] Acceptance test: Create a task, then retrieve it by ID and verify all fields match
- [ ] Unit test: Write unit test for kanbn_get_task handler with mock Kanbn instance
- [ ] Acceptance test: Verify error is thrown when task ID does not exist

## History

- type: created
  date: 2026-09-06T20:33:47.256Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-10T04:55:50.256Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
