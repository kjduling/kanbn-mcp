---
created: 2026-09-10T04:37:04.417Z
updated: 2026-09-12T22:44:28.224Z
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

- [ ] Log or re-throw error when column fallback fails
- [ ] Update tool schema description to clarify column is optional
- [ ] Add unit test for successful column fallback
- [ ] Add unit test for failed column fallback

## History

- type: created
  date: 2026-09-10T04:37:04.417Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-12T22:44:28.224Z
  fromColumn: Backlog
  toColumn: Todo
  author: Kevin J. Duling
