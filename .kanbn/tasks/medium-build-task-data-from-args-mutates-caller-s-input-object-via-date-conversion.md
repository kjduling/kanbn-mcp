---
created: 2026-09-10T04:30:19.085Z
updated: 2026-09-12T21:33:34.977Z
completed: 2026-09-12T21:33:34.977Z
---

# MEDIUM: buildTaskDataFromArgs mutates caller's input object via Date conversion

## Problem

`buildTaskDataFromArgs` receives `args` from the MCP caller. When date keys are present:

```ts
const metadata: Record<string, any> = {};
// ...
Object.assign(metadata, source.metadata);  // shallow copy
convertDatesInObject(metadata);              // mutates metadata in-place
```

`convertDatesInObject` replaces string values with `new Date()` objects:

```ts
obj[key] = parsed;  // mutates the object
```

Since `metadata` is a shallow copy of `source.metadata`, and `source` is a shallow copy of `args`, the caller's original `args` object is mutated — string date values become Date objects.

## Risk

- If the caller reuses `args` after calling `buildTaskDataFromArgs`, they get Date objects where they expected strings
- JSON serialisation of the caller's object will differ from what they passed in
- Makes the function non-idempotent and harder to reason about

## Acceptance Criteria

- [ ] `buildTaskDataFromArgs` does not mutate the input `args` object
- [ ] All intermediate copies are deep enough to prevent reference sharing
- [ ] Unit test passes the same `args` object twice and verifies both outputs are equivalent
- [ ] Unit test verifies that Date conversion produces correct ISO strings after the call

## Sub-tasks

- [x] Deep-copy metadata before mutating date values
- [x] Add unit test for double-call idempotency on same args
- [x] Add unit test verifying Date output correctness after call

## History

- type: moved
  date: 2026-09-12T21:33:34.977Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
