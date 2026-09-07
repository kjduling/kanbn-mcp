---
created: 2026-09-07T18:00:58.204Z
updated: 2026-09-07T18:32:32.854Z
---

# Fix silent column fallback in handleKanbnCreateTask

In `handleKanbnCreateTask`, if column detection fails the error is silently swallowed:

```js
try {
    const getIndexFn = instance.getIndex || instance.index || instance.loadIndex;
    if (typeof getIndexFn === "function") {
        const index = await getIndexFn.call(instance);
        // ... auto-detect first column ...
    }
} catch { }
// ← If this fails, column is undefined and createFn gets called without it
```

If the index can't be loaded, the task is created without a column. Whether that's valid depends on the Kanbn instance, but the caller never knows something went wrong.

**Required fix:**
- Log a warning when column auto-detection fails
- Return an error response if column cannot be determined and the Kanbn instance requires one
- Or, explicitly pass `undefined` and document that the Kanbn instance will use its default column

## Sub-tasks

- [ ] undefined
- [ ] undefined
- [ ] Create a unit test to verify

## History

- type: created
  date: 2026-09-07T18:00:58.204Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
