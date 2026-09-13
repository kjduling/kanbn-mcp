---
created: 2026-09-12T05:07:35.653Z
updated: 2026-09-13T18:56:03.329Z
started: 2026-09-13T07:00:00.000Z
completed: 2026-09-13T18:56:03.329Z
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

- [x] Implement `kanbn_get_config` tool
- [x] Implement `kanbn_save_config` tool with config param
- [x] Implement `kanbn_get_action_rules` tool
- [x] Implement `kanbn_find_action_warnings` tool
- [x] Implement `kanbn_get_date_format` tool
- [x] Implement `kanbn_get_task_template` tool
- [x] Implement `kanbn_get_workspace_options` tool
- [x] Implement `kanbn_validate_board` tool with optional save param
- [x] Unit tests — happy paths (get/save config, get rules, validate passing)
- [x] Unit tests — sad paths (invalid config, validation failures, no config file)

## Comments

- author: Jinx
  date: 2026-09-13T05:45:00.000Z
  All 8 config/validation tools implemented as thin wrappers over the kanbn lib: kanbn_get_config (returns config JSON or 'No config file found'), kanbn_save_config (requires config param), kanbn_get_action_rules (passes pre-loaded index to avoid double load), kanbn_find_action_warnings, kanbn_get_date_format, kanbn_get_task_template (sync, need getIndex first), kanbn_get_workspace_options, kanbn_validate_board (returns 'Board is valid' or parsing-error JSON; optional save param). Added shared getBoardIndex helper. Each tool has handler + TOOLS entry + dispatch case + HELP_TEXT + README row. 11 tests: happy paths (null config, save+read-back, empty rules, empty warnings, date format, task template, workspace options, valid board) and sad paths (missing config param, corrupt board parse errors, missing board). 128/128 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T18:56:03.329Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
