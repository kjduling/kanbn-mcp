---
created: 2026-09-07T18:00:58.171Z
updated: 2026-09-07T18:33:07.267Z
---

# Fix buildTaskDataFromArgs mutating input objects

The `buildTaskDataFromArgs` function mutates the input `metadata` object in place:

```js
convertDatesInObject(metadata);
```

This converts date strings to `Date` objects on the caller's original object. If the caller reuses the same object, they'll get surprising results on a second call — date strings become Date objects, which may break date parsing on retry.

**Required fix:**
- Create a deep copy of the metadata object before modifying it
- Ensure no input object is mutated by the function
- Document that the function returns a new object rather than mutating inputs

## Sub-tasks

- [ ] undefined
- [ ] undefined
- [ ] Create a unit test to verify

## History

- type: created
  date: 2026-09-07T18:00:58.171Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
