---
created: 2026-09-10T04:30:19.062Z
---

# CRITICAL: handleKanbnInitBoard silently discards errors from both init attempts

## Problem

`handleKanbnInitBoard` tries two different call signatures for the Kanbn init function:

```ts
try {
    await initFn.call(instance, boardName, columns);
} catch {
    await initFn.call(instance, { name: boardName, columns });
}
```

If *both* calls throw an error, the second `catch` block is never entered (the second call is outside the try). The function then returns `{ content: [{ text: 'Successfully initialized Kanbn board at: ...' }] }` even though the board was **not** initialized.

## Risk

- Callers (including `kanbn_ensure_board`) believe the board was created when it wasn't
- Subsequent operations will fail cryptically or silently
- No way to diagnose why initialization failed

## Acceptance Criteria

- [ ] Both init attempts are wrapped in a single try/catch
- [ ] If both attempts fail, the error is re-thrown to the caller
- [ ] Unit test verifies that a failed init propagates the error
- [ ] Unit test verifies that a successful first attempt returns success

## Sub-tasks

- [ ] Wrap both initFn calls in a single try/catch block
- [ ] Re-throw error if both init attempts fail
- [ ] Add unit test for failed init propagating error
- [ ] Add unit test for successful first-attempt init

## History

- type: created
  date: 2026-09-10T04:30:19.062Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
