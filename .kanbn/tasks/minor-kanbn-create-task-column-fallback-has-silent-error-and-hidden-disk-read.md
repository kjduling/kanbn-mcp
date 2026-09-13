---
created: 2026-09-10T04:37:04.417Z
updated: 2026-09-13T16:52:29.926Z
completed: 2026-09-13T16:52:29.926Z
---

# MINOR: kanbn_create_task column fallback has silent error and hidden disk read

## Problem

When no `column` is provided to `kanbn_create_task`, the handler fetches the board index to find the first column:

```ts
if (!column) {
    try {
        const getIndexFn = instance.getIndex || instance.index || instance.loadIndex;
        if (typeof getIndexFn === 'function') {
            const index = await getIndexFn.call(instance);
            // ...
        }
    } catch { }
}
```

If `getIndexFn` throws, the error is silently swallowed. The task is then created without a column, which may fail or behave unpredictably depending on the Kanbn library's tolerance.

## Risk

- The tool schema doesn't indicate that `column` is optional or that a fallback exists
- Silent error means the caller never knows the fallback failed
- Unexpected columnless task creation may corrupt board state

## Acceptance Criteria

- [ ] If column fallback fails, the error is logged or re-thrown
- [ ] Tool schema clarifies that `column` is optional but strongly recommended
- [ ] Unit test covers the fallback when columns are available
- [ ] Unit test covers the failure path when index fetch fails

## Sub-tasks

- [x] Log or re-throw error when column fallback fails
- [x] Update tool schema description to clarify column is optional
- [x] Add unit test for successful column fallback
- [x] Add unit test for failed column fallback

## Comments

- author: Jinx
  date: 2026-09-13T05:00:00.000Z
  Column fallback no longer swallows index errors: bare catch replaced with a wrapped re-throw ('Failed to determine fallback column for kanbn_create_task: ...') plus a comment explaining the fallback reads the board index for the first column. Schema description updated: 'Target column for the new task (optional; defaults to the board's first column)'; handler JSDoc clarified. 2 unit tests: omitted column lands in first column; deleting index.md makes fallback reject with the wrapped error. 111/111 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T16:52:29.926Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
