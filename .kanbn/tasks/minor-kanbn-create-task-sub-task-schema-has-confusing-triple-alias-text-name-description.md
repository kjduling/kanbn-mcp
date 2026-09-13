---
created: 2026-09-10T04:30:19.147Z
updated: 2026-09-12T22:44:25.472Z
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

- [ ] Clarify schema: mark name/description as deprecated aliases
- [ ] Add precedence documentation comment in code
- [ ] Add unit test for each alias individually
- [ ] Add unit test for multi-alias precedence

## History

- type: created
  date: 2026-09-10T04:30:19.147Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-12T22:44:25.472Z
  fromColumn: Backlog
  toColumn: Todo
  author: Kevin J. Duling
