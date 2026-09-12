---
created: 2026-09-07T18:00:58.055Z
updated: 2026-09-11T22:01:38.982Z
column: Backlog
---

# Fix silent error swallowing in enqueueKanbnOperation

The `enqueueKanbnOperation` function swallows both success and failure silently in its Promise chain:

```js
operationQueue = result.then(
    () => { },
    () => { }    // ← ERROR GONE
);
```

Any error from a Kanbn operation is silently swallowed. A failed task creation will just vanish without any indication to the caller. This is the worst kind of bug — it looks like it works until it doesn't.

**Required fix:**
- Add proper error logging or re-throw in the failure handler
- Consider logging errors to stderr or returning an error response
- Ensure the promise chain doesn't lose error context

## Relations

- [Duplicates medium-operation-queue-swallows-errors-and-corrupts-subsequent-queued-operations](medium-operation-queue-swallows-errors-and-corrupts-subsequent-queued-operations.md)

## History

- type: created
  date: 2026-09-07T18:00:58.055Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: archived
  date: 2026-09-11T22:01:39.584Z
  fromColumn: Backlog
  author: Kevin J. Duling
