---
created: 2026-09-06T22:08:33.866Z
updated: 2026-09-07T00:44:03.202Z
assigned: Kevin
tags:
  - bug
  - concurrency
  - race-condition
  - kanbn
  - index.md
started: 2026-09-07T00:41:57.928Z
completed: 2026-09-07T00:44:03.202Z
column: Done
---

# Fix race condition on index.md during rapid task creation

When creating multiple tasks in rapid succession via the MCP server, only 2 of 4 tasks appear in `.kanbn/index.md` despite all 4 task files existing in `.kanbn/tasks/`.

**Root Cause:** Concurrency/race condition in `basementuniverse/kanbn` (or how the server calls it). Task creation performs two operations:
1. Creates/saves the task Markdown file in `.kanbn/tasks/`
2. Reads, updates, and overwrites `.kanbn/index.md` to add the task reference

Rapid successive calls cause `index.md` to be read concurrently, then overwritten — the last writer wins, wiping earlier entries.

**Fix:** Serialize board-modifying operations in `server.ts` using an async mutex/promise queue:

```ts
let operationQueue = Promise.resolve();

function enqueueKanbnOperation<T>(op: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(op);
  operationQueue = result.catch(() => {});
  return result;
}
```

Apply to `createTask`, `moveTask`, and any other board mutation handlers.

## Comments

- author: Kevin J. Duling
  date: 2026-09-07T00:42:27.945Z
  Added logic to enqueue commands, fixed issues stemming from regression testing.

## History

- type: created
  date: 2026-09-06T22:08:33.866Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-07T00:41:57.928Z
  fromColumn: Backlog
  toColumn: In Progress
  author: Kevin J. Duling
- type: moved
  date: 2026-09-07T00:44:03.202Z
  fromColumn: In Progress
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-12T01:54:04.928Z
  fromColumn: Done
  author: Kevin J. Duling
