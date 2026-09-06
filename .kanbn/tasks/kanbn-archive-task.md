---
tags:
  - mcp-tool
  - kanbn-wrapper
  - feature
created: 2026-09-06T20:33:47.290Z
---

# kanbn_archive_task

Implement `kanbn_archive_task` MCP tool that archives a task on the Kanbn board.

The tool should:
- Accept `taskId` (required) and `path` (optional) parameters
- Call `kanbn.archiveTask(taskId)` to archive the task
- Return a success message or the archived task data
- Handle the case where the task is not found (throw a clear error)
- Support optional `path` parameter to target a specific project directory

## Sub-tasks

- [ ] Implement kanbn_archive_task tool definition in server.ts (inputSchema with taskId, path)
- [ ] Implement handler function that calls kanbn.archiveTask(taskId) and returns result
- [ ] Add routing in the CallToolRequest handler to dispatch to kanbn_archive_task
- [ ] Acceptance test: Create a task, archive it, verify it is no longer visible in normal board status
- [ ] Unit test: Write unit test for kanbn_archive_task handler with mock Kanbn instance
- [ ] Acceptance test: Verify error is thrown when archiving a non-existent task

## History

- type: created
  date: 2026-09-06T20:33:47.290Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
