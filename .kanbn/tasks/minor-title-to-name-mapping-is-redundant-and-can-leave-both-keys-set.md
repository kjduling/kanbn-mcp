---
created: 2026-09-10T04:37:04.407Z
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

- [ ] Move title-to-name mapping into the main assignment loop
- [ ] Add unit test for both title and name provided
- [ ] Add unit test for title-only mapping to name

## History

- type: created
  date: 2026-09-10T04:37:04.407Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
