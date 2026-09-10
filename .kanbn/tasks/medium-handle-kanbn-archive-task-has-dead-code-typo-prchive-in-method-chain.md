---
created: 2026-09-10T04:30:19.113Z
---

# MEDIUM: handleKanbnArchiveTask has dead-code typo 'prchive' in method chain

## Problem

In `handleKanbnArchiveTask`:

```ts
const archiveFn = instance.archiveTask || instance.archive || instance.prchive;
```

`instance.prchive` is a typo (should be `archive`). Since `instance.archive` is already checked before it, `instance.prchive` is dead code — it will never match.

## Risk

- Cosmetic issue only; no functional bug if the library uses `archive` or `archiveTask`
- If the library renames the method to something like `prchive` (unlikely but possible), the fallback silently fails
- Suggests the code wasn't carefully reviewed

## Acceptance Criteria

- [ ] Typo is fixed to remove dead code
- [ ] Unit test covers the `archive` fallback path
- [ ] Unit test covers the `archiveTask` primary path

## Sub-tasks

- [ ] Remove dead-code 'prchive' from method chain
- [ ] Add unit test for archive fallback path
- [ ] Add unit test for archiveTask primary path

## History

- type: created
  date: 2026-09-10T04:30:19.113Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
