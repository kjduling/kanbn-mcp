---
created: 2026-09-10T04:30:19.133Z
---

# MEDIUM: kanbn_ensure_board reports success even if init silently fails

## Problem

`handleKanbnEnsureBoard` calls `handleKanbnInitBoard` when the board isn't initialized:

```ts
if (!initialized) {
    await handleKanbnInitBoard(args);
}
return {
    content: [{ type: 'text', text: `Ensured Kanbn board exists at: ${boardPath}` }],
};
```

If `handleKanbnInitBoard` fails silently (see issue #2), this function still returns a success message. The caller has no way to know the board was not created.

## Risk

- Cascading silent failure: `ensure_board` is a commonly used tool that gives false confidence
- Downstream operations will fail cryptically
- Hard to debug because the tool reports success

## Acceptance Criteria

- [ ] If `handleKanbnInitBoard` throws, `handleKanbnEnsureBoard` propagates the error
- [ ] Unit test verifies error propagation when init fails
- [ ] Unit test verifies success path when board is already initialized

## Sub-tasks

- [ ] Propagate error from handleKanbnInitBoard in ensure_board
- [ ] Add unit test for error propagation when init fails
- [ ] Add unit test for already-initialized success path

## History

- type: created
  date: 2026-09-10T04:30:19.133Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
