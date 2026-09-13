---
created: 2026-09-12T05:05:58.284Z
updated: 2026-09-13T19:49:06.324Z
completed: 2026-09-13T19:49:06.324Z
---

# kanbn-contributors — contributor management

Implement MCP tools for kanbn library contributor methods:
- `getContributors()` → `kanbn_get_contributors`
- `findContributor(value)` → `kanbn_find_contributor`
- `currentUser()` → `kanbn_current_user`
- `collectContributorValues()` → `kanbn_collect_contributor_values`
- `getContributorUsage()` → `kanbn_contributor_usage`
- `findContributorWarnings()` → `kanbn_contributor_warnings`

Acceptance criteria:
- `kanbn_get_contributors` returns normalised contributor array
- `kanbn_find_contributor` matches by name, display name, or aliases
- `kanbn_current_user` resolves KANBN_USER → git email → git name → null
- `kanbn_contributor_usage` returns usage stats with spelling variants
- `kanbn_contributor_warnings` returns unknown contributor warnings

## Sub-tasks

- [x] Implement `kanbn_get_contributors` tool
- [x] Implement `kanbn_find_contributor` tool with value param
- [x] Implement `kanbn_current_user` tool
- [x] Implement `kanbn_collect_contributor_values` tool
- [x] Implement `kanbn_contributor_usage` tool
- [x] Implement `kanbn_contributor_warnings` tool
- [x] Unit tests — happy paths (get, find, current user, usage, warnings)
- [x] Unit tests — sad paths (unknown value, no git config)

## Comments

- author: Jinx
  date: 2026-09-13T06:15:00.000Z
  All 6 contributor tools implemented as thin wrappers over the lib: kanbn_get_contributors (normalised list), kanbn_find_contributor (name/display/alias match, requires value), kanbn_current_user (KANBN_USER → git), kanbn_collect_contributor_values (Map/Set converted to plain object), kanbn_contributor_usage (spelling variants + unknown), kanbn_contributor_warnings (unknown-contributor warnings). Workspace-scoped tools skip the board init check; usage-family errors wrapped. TOOLS entries, dispatch cases, HELP_TEXT, README rows all added. 10 tests: normalised list, empty list, name/display/alias match, unknown null, missing value, KANBN_USER, collect keyed usage, usage spelling variants, warnings flag only unknown, uninitialised dir error. 146/146 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T19:49:06.324Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
