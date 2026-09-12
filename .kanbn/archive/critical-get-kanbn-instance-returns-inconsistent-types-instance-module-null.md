---
created: 2026-09-10T04:30:19.074Z
updated: 2026-09-11T21:00:39.237Z
progress: 1
started: 2026-09-11T20:40:28.949Z
completed: 2026-09-11T20:46:54.879Z
column: Done
---

# CRITICAL: getKanbnInstance returns inconsistent types (instance | module | null)

## Problem

`getKanbnInstance` has three possible return paths:

```ts
if (typeof Kanbn === 'function') {
    return new Kanbn(boardPath);  // → Kanbn instance
}
if (mod && typeof mod === 'object') {
    return mod;                   // → raw module object
}
return null;
```

When the library exports a module object (not a class constructor), the raw `mod` is returned. This object has no `initialised()`, `getIndex()`, etc. — it's the module namespace, not an instance.

Callers like `isBoardInitialized()` then do:
```ts
const fn = instance.initialised || instance.initialized || instance.isInitialized || instance.isInitialised;
```

If `instance` is the module object, all of these are `undefined`, so the board always appears uninitialised.

## Risk

- Boards that are actually initialized are reported as uninitialized
- `kanbn_ensure_board` will try to re-initialise an already-initialized board
- `kanbn_status` returns 'No Kanbn board found' incorrectly

## Acceptance Criteria

- [ ] `getKanbnInstance` returns a consistent type: either always an instance or always null (never the raw module)
- [ ] If the library exports a module object, extract the `Kanbn` class from it and instantiate
- [ ] Unit test covers the module-object export path
- [ ] Unit test covers the class-constructor export path
- [ ] Unit test covers the not-found path returning null

## Sub-tasks

- [x] getKanbnInstance returns a consistent type: either always an instance or always null (never the raw module)
- [x] If the library exports a module object, extract the Kanbn class from it and instantiate
- [x] Unit test covers the module-object export path
- [x] Unit test covers the class-constructor export path
- [x] Unit test covers the not-found path returning null

## History

- type: moved
  date: 2026-09-11T20:46:54.879Z
  fromColumn: In Progress
  toColumn: Done
  author: Kevin J. Duling
- type: progress
  date: 2026-09-11T21:00:39.232Z
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
- type: archived
  date: 2026-09-12T01:54:14.244Z
  fromColumn: Done
  author: Kevin J. Duling
