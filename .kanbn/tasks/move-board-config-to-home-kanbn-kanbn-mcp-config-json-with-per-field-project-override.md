---
tags:
  - feature
  - high
created: 2026-10-13T20:01:48.281Z
updated: 2026-10-13T22:01:04.102Z
---

# Move board config to $HOME/.kanbn/kanbn-mcp-config.json with per-field project override

Rename and relocate the setup answers file, and make it overridable.

- Rename `setup.json` -> `kanbn-mcp-config.json` so the filename says what it is (it is config, not setup state).
- Default (global) location: `$HOME/.kanbn/kanbn-mcp-config.json` - holds the default board columns and tags (and the rest of the board conventions: tag style, WIP limits, custom fields, relation mirroring).
- Project override: `<board>/.kanbn/kanbn-mcp-config.json` overrides the global PER FIELD. Resolved config = global merged with project (project wins on any field it sets; unset fields inherit the global default).
- CLI: `kanbn-mcp setup` writes the global config. `kanbn-mcp setup --project` uses the global config as its base and lets the user answer questions to override fields for this project, then writes the project-local file. No-flag setup must not silently write both.

Board decision (2026-10-13): project overrides per field; there is no wholesale replace.

Interaction: the "deterministic uninstall" ticket removes the state arrays, so this file becomes pure configuration. Merge order global -> project is the single source of truth for both guidance rendering and the derived uninstall target set.

## Sub-tasks

- [ ] Rename setup.json -> kanbn-mcp-config.json across questions.ts/types and every reference (code, help, README, tests)
- [ ] Set the default (global) path to $HOME/.kanbn/kanbn-mcp-config.json; keep the project path at <board>/.kanbn/kanbn-mcp-config.json
- [ ] Implement the per-field merge: global supplies defaults, project overrides fields it sets; resolve() feeds guidance + uninstall
- [ ] CLI: no-flag `setup` writes the global config; `--project` seeds its answers from the global config as the base and prompts the user to override individual fields for the project, writing the project-local config
- [ ] Define re-run/amend semantics against the global file, and `--project` re-runs against the project file
- [ ] Update HELP_TEXT + README + any guidance/SKILL text that names the old file or path
- [ ] verify global-only, project-only, and both-present resolution (project wins per field)
- [ ] verify `kanbn-mcp setup --project` writes only the project file and leaves the global file untouched
- [ ] add tests for per-field merge precedence and each of the three presence cases

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)
- [related-to make-kanbn-mcp-uninstall-and-check-deterministic-drop-written-registered-state-from-the-config](make-kanbn-mcp-uninstall-and-check-deterministic-drop-written-registered-state-from-the-config.md)
- [related-to setup-output-should-report-where-it-stores-files-mirroring-uninstall-s-removed-left-in-place-report](setup-output-should-report-where-it-stores-files-mirroring-uninstall-s-removed-left-in-place-report.md)
- [blocks add-a-per-project-board-path-to-home-kanbn-kanbn-mcp-config-json-replaces-kanbn-default-path](add-a-per-project-board-path-to-home-kanbn-kanbn-mcp-config-json-replaces-kanbn-default-path.md)

## Comments

- author: Kevin J. Duling
  date: 2026-10-13T20:04:01.630Z
  Decision (2026-10-13): `kanbn-mcp setup --project` uses the global $HOME config as its base defaults and prompts the user to answer questions to override fields for the project; the result is written to the project-local kanbn-mcp-config.json. Per-field project override stands.
