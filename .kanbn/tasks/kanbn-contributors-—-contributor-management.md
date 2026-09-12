---
created: 2026-09-12T05:05:58.284Z
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

- [ ] Implement `kanbn_get_contributors` tool
- [ ] Implement `kanbn_find_contributor` tool with value param
- [ ] Implement `kanbn_current_user` tool
- [ ] Implement `kanbn_contributor_usage` tool
- [ ] Implement `kanbn_contributor_warnings` tool
- [ ] Unit tests — happy paths (get, find, current user, usage, warnings)
- [ ] Unit tests — sad paths (unknown value, no git config)

## History

- type: created
  date: 2026-09-12T05:05:58.284Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
