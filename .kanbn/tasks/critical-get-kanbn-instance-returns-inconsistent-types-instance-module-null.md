---
created: 2026-09-10T04:30:19.074Z
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

- [ ] Normalize getKanbnInstance to always return an instance or null
- [ ] Extract Kanbn class from module object exports
- [ ] Add unit test for module-object export path
- [ ] Add unit test for class-constructor export path
- [ ] Add unit test for not-found returning null

## History

- type: created
  date: 2026-09-10T04:30:19.074Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
