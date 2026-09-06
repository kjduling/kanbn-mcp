---
tags:
  - bug
  - concurrency
  - race-condition
  - kanbn
  - index.md
created: 2026-09-06T22:08:33.866Z
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

## History

- type: created
  date: 2026-09-06T22:08:33.866Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
