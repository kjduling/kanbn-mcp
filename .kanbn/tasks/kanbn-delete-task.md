---
tags:
  - mcp-tool
  - kanbn-wrapper
  - feature
created: 2026-09-06T20:33:47.290Z
---

# kanbn_delete_task

Implement `kanbn_delete_task` MCP tool that deletes a task from the Kanbn board.

The tool should:
- Accept `taskId` (required) and `path` (optional) parameters
- Accept optional `force` parameter (boolean) to bypass safety checks
- Call `kanbn.deleteTask(taskId, force)` to delete the task
- Return a success message or the deleted task data
- Handle the case where the task is not found (throw a clear error)
- Support optional `path` parameter to target a specific project directory

## Sub-tasks

- [ ] Implement kanbn_delete_task tool definition in server.ts (inputSchema with taskId, optional force, path)
- [ ] Implement handler function that calls kanbn.deleteTask(taskId, force) and returns result
- [ ] Add routing in the CallToolRequest handler to dispatch to kanbn_delete_task
- [ ] Acceptance test: Create a task, delete it, verify it no longer appears in board status
- [ ] Unit test: Write unit test for kanbn_delete_task handler with mock Kanbn instance
- [ ] Acceptance test: Verify error is thrown when deleting a non-existent task

## History

- type: created
  date: 2026-09-06T20:33:47.290Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
