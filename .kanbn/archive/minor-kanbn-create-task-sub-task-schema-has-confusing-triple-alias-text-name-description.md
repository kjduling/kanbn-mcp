---
created: 2026-09-10T04:30:19.147Z
updated: 2026-09-13T16:41:16.088Z
completed: 2026-09-13T16:41:16.088Z
column: Done
---

# MINOR: kanbn_create_task subTask schema has confusing triple-alias (text/name/description)

## Problem

In the `kanbn_create_task` tool schema, subTask items have three properties that all resolve to the same thing:

```json
{
    "text": { "type": "string", "description": "Sub-task text" },
    "name": { "type": "string", "description": "Alias for text" },
    "description": { "type": "string", "description": "Alias for text" }
}
```

In `buildTaskDataFromArgs`, all three are handled:

```ts
text: String(sub?.text ?? sub?.name ?? sub?.description ?? ""),
```

The precedence is unclear — a caller might set both `name` and `text` and not know which wins. The schema also documents `name` and `description` as "Alias for text" which is redundant and confusing.

## Risk

- Callers may set multiple fields and get unexpected results
- The schema is self-contradictory (three fields, same purpose)
- Increases cognitive load for anyone writing MCP tool calls

## Acceptance Criteria

- [ ] Schema is simplified to one primary field (`text`) with `name` and `description` documented as deprecated aliases
- [ ] Code precedence is clearly documented in a comment
- [ ] Unit test verifies each alias individually produces the same result
- [ ] Unit test verifies that when multiple aliases are set, the documented primary takes precedence

## Sub-tasks

- [x] Clarify schema: mark name/description as deprecated aliases
- [x] Add precedence documentation comment in code
- [x] Add unit test for each alias individually
- [x] Add unit test for multi-alias precedence

## Comments

- author: Jinx
  date: 2026-09-13T03:30:00.000Z
  Sub-task schema simplified in both kanbn_create_task and kanbn_edit_task: text documented as the primary field; name/description marked as deprecated aliases ('ignored when text is set' / 'ignored when text or name is set'). Precedence comment added in buildTaskDataFromArgs (text ?? name ?? description). 2 unit tests: each alias individually maps to text; multiple aliases respect precedence (text > name > description). 106/106 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T16:41:16.088Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T16:56:06.697Z
  fromColumn: Done
  author: Kevin J. Duling
