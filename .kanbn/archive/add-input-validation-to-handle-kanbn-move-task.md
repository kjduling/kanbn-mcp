---
created: 2026-09-07T18:00:58.125Z
updated: 2026-09-13T20:19:09.136Z
completed: 2026-09-13T20:19:09.136Z
column: Done
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

- [x] Validate that taskId is provided and non-empty
- [x] Validate that targetColumn is provided and non-empty
- [x] Return a clear validation error response if either is missing
- [x] Add the required constraint to the tool schema if not already present

## Comments

- author: Jinx
  date: 2026-09-13T20:50:00.000Z
  Added empty-string-safe validation to handleKanbnMoveTask: non-empty taskId required (else 'Missing required parameter: taskId'), non-empty targetColumn after the existing column/targetColumn/col fallback (else 'Missing required parameter: targetColumn'). The tool schema already declared required: ["taskId", "targetColumn"], so no schema change was needed — the handler now enforces what the schema promised. 2 tests added (160 → 162), all passing, tsc clean.

## History

- type: moved
  date: 2026-09-13T20:19:09.136Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T21:48:57.242Z
  fromColumn: Done
  author: Kevin J. Duling
