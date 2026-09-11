---
created: 2026-09-07T18:00:58.101Z
updated: 2026-09-11T21:03:28.218Z
column: Backlog
---

# Fix handleKanbnInitBoard silent failure on both init attempts

The `handleKanbnInitBoard` function tries two different calling conventions for the init function:

```js
try {
    await initFn.call(instance, boardName, columns);
} catch {
    await initFn.call(instance, { name: boardName, columns });
}
// ← If BOTH calls throw, the function still returns "Successfully initialized"
```

If both calls throw, the error is swallowed and a misleading success message is returned. The caller has no idea anything went wrong.

**Required fix:**
- Re-throw the error if both init attempts fail
- Include the last error message in the thrown error for debugging
- Return an error response instead of silently succeeding

## Relations

- [Duplicate critical-handle-kanbn-init-board-silently-discards-errors-from-both-init-attempts](critical-handle-kanbn-init-board-silently-discards-errors-from-both-init-attempts.md)

## History

- type: created
  date: 2026-09-07T18:00:58.101Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: archived
  date: 2026-09-11T21:05:05.222Z
  fromColumn: Backlog
  author: Kevin J. Duling
