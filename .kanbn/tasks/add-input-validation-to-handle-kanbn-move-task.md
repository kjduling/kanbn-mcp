---
created: 2026-09-07T18:00:58.125Z
---

# Add input validation to handleKanbnMoveTask

The `handleKanbnMoveTask` function has no validation on its required parameters:

```js
const taskId = args.taskId as string;
const targetColumn = args.targetColumn || args.column || args.col;
// ← If both are falsy, you're calling moveTask(null, undefined)
```

No check that `taskId` is non-empty or that `targetColumn` exists. The underlying Kanbn instance will throw, but the error message will be unhelpful and the root cause is unclear.

**Required fix:**
- Validate that `taskId` is provided and non-empty
- Validate that `targetColumn` is provided and non-empty
- Return a clear validation error response if either is missing
- Add the `required` constraint to the tool schema if not already present

## Sub-tasks

- [ ] undefined
- [ ] undefined
- [ ] undefined
- [ ] undefined

## History

- type: created
  date: 2026-09-07T18:00:58.125Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
