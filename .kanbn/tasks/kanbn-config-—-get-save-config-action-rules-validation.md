---
created: 2026-09-12T05:07:35.653Z
---

# kanbn-config — get/save config, action rules, validation

Implement MCP tools for kanbn library config and validation methods:
- `getConfig()` / `saveConfig(config)` → `kanbn_get_config` / `kanbn_save_config`
- `getActionRules(index)` → `kanbn_get_action_rules`
- `findActionWarnings()` → `kanbn_find_action_warnings`
- `getDateFormat(index)` → `kanbn_get_date_format`
- `getTaskTemplate(index)` → `kanbn_get_task_template`
- `getWorkspaceOptions()` → `kanbn_get_workspace_options`
- `validate(save)` → `kanbn_validate_board`

Acceptance criteria:
- `kanbn_get_config` returns config or null if no separate config exists
- `kanbn_save_config` persists config and returns success
- `kanbn_get_action_rules` returns action rules array
- `kanbn_find_action_warnings` returns potential issues with action rules
- `kanbn_get_date_format` returns the date format string from index
- `kanbn_get_task_template` returns the task template string
- `kanbn_get_workspace_options` returns workspace-scoped options
- `kanbn_validate_board` returns true or array of parsing errors

## Sub-tasks

- [ ] Implement `kanbn_get_config` tool
- [ ] Implement `kanbn_save_config` tool with config param
- [ ] Implement `kanbn_get_action_rules` tool
- [ ] Implement `kanbn_find_action_warnings` tool
- [ ] Implement `kanbn_get_date_format` tool
- [ ] Implement `kanbn_get_task_template` tool
- [ ] Implement `kanbn_get_workspace_options` tool
- [ ] Implement `kanbn_validate_board` tool with optional save param
- [ ] Unit tests — happy paths (get/save config, get rules, validate passing)
- [ ] Unit tests — sad paths (invalid config, validation failures, no config file)

## History

- type: created
  date: 2026-09-12T05:07:35.653Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
