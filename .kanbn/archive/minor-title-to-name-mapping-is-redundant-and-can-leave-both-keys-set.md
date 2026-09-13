---
created: 2026-09-10T04:37:04.407Z
updated: 2026-09-13T16:48:24.956Z
completed: 2026-09-13T16:48:24.956Z
column: Done
---

# MINOR: title-to-name mapping is redundant and can leave both keys set

## Problem

In `buildTaskDataFromArgs`:

```ts
const topLevelKeys = new Set(["name", "title", "description", "subTasks", "comments", "relations"]);
```

If the caller provides both `title` and `name`, both end up in `taskData`:
```ts
if (topLevelKeys.has(key)) {
    taskData[key] = value;  // adds BOTH title and name
}
```

Then a second pass tries to fix it:
```ts
if (taskData.title && !taskData.name) {
    taskData.name = taskData.title;
}
```

But if both are set, neither condition triggers — `taskData` ends up with both keys populated, which is inconsistent.

## Risk

- Duplicate keys in the task object create ambiguity downstream
- The second-pass fix is a band-aid that doesn't cover all cases
- Callers may not know which key is authoritative

## Acceptance Criteria

- [ ] `title` is mapped to `name` at assignment time, not as a second pass
- [ ] If both are provided, `name` takes precedence with a warning or `title` overrides
- [ ] Unit test verifies only `name` is present when both `title` and `name` are provided
- [ ] Unit test verifies `title` alone correctly maps to `name`

## Sub-tasks

- [x] Move title-to-name mapping into the main assignment loop
- [x] Add unit test for both title and name provided
- [x] Add unit test for title-only mapping to name

## Comments

- author: Jinx
  date: 2026-09-13T04:30:00.000Z
  title→name mapping now happens at assignment time: title removed from topLevelKeys and handled in the main loop — it maps to name only when name is unset, so name is canonical and wins regardless of input key order, and title never leaks as its own key. Second-pass band-aid deleted. 2 unit tests: title-only maps to name (no title key left); both provided in either order yield name only. 109/109 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T16:48:24.956Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T16:56:12.952Z
  fromColumn: Done
  author: Kevin J. Duling
