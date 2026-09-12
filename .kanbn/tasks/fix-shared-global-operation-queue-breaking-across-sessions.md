---
created: 2026-09-07T18:00:58.142Z
updated: 2026-09-12T18:55:13.345Z
started: 2026-09-12T18:55:13.345Z
---

# Fix shared global operationQueue breaking across sessions

The `operationQueue` is a module-level singleton:

```js
let operationQueue: Promise<void> = Promise.resolve();
```

This causes issues:
1. If the MCP server handles multiple concurrent connections, operations from different sessions serialize through the same queue
2. If the server is restarted while operations are queued, queue state is lost or corrupted
3. Operations from different 'users' (if ever applicable) would interfere with each other

**Required fix:**
- Consider using a per-connection or per-request queue instead of a global one
- If a global queue is kept, add a mechanism to reset or isolate it per session
- Document the current limitation clearly

## History

- type: created
  date: 2026-09-07T18:00:58.142Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-12T18:10:55.427Z
  fromColumn: Backlog
  toColumn: Todo
  author: Kevin J. Duling
- type: moved
  date: 2026-09-12T18:55:13.345Z
  fromColumn: Todo
  toColumn: In Progress
  author: Kevin J. Duling
