---
progress: 1
tags:
  - feature
  - high
created: 2026-10-13T20:01:48.281Z
updated: 2026-10-18T18:21:30.841Z
started: 2026-10-18T17:52:07.720Z
completed: 2026-10-18T18:21:30.809Z
---

# Move board config to $HOME/.kanbn/kanbn-mcp-config.json with per-field project override

Rename and relocate the setup answers file, and make it overridable.

BOARD DECISION REVISION (2026-10-18, Kevin): there is NO project-level config file at all. A board directory holds only board files (index.md, tasks/, archive/). Everything lives in ONE global file:

- File: $HOME/.kanbn/kanbn-mcp-config.json (renamed from .kanbn/setup.json - it is config, not setup state).
- Contents: schemaVersion, `answers` (the global/default board conventions: columns, type/priority tags, tag style, WIP limits, custom fields, relation mirroring) and `projects` (per-project answer overrides keyed by absolute project root).
- Resolution is PER FIELD: defaults <- global answers <- the project's override entry. boardRoot is always derived from the resolved project root, never inherited.
- CLI: `kanbn-mcp setup` amends the GLOBAL answers (seeded from the global config). `kanbn-mcp setup --project` seeds from the global answers + this project's overrides and writes ONLY the project's override entry - the fields differing from the global answers; setting a field back to its global value clears the override (it inherits again). Neither mode writes the other's section. Both modes emit guidance rendered from the MERGED result.
- Re-runs: no-flag re-runs amend the global answers; --project re-runs amend the project entry (accepting every inherited default preserves existing overrides).
- uninstall leaves the global config behind and reports "Configuration left in place: <path>".
- Legacy `<board>/.kanbn/setup.json` is a CLEAN BREAK: ignored, never read, never migrated (board decision 2026-10-18).

Interaction: the "deterministic uninstall" ticket makes this file pure configuration; the per-project board path ticket adds a `boardPath` key to the SAME `projects` map in this file (a location, not a board convention - it stays out of the answers merge).

## Sub-tasks

- [x] Rename setup.json -> kanbn-mcp-config.json across questions.ts/types and every reference (code, help, README, tests)
- [x] Config lives at $HOME/.kanbn/kanbn-mcp-config.json ONLY - no project-level config file; a board holds only board files (index.md, tasks/, archive/)
- [x] Implement the per-field merge (defaults <- global answers <- projects[root]); resolve() feeds guidance rendering, install and uninstall target derivation
- [x] CLI: no-flag setup amends the global answers; --project seeds from global + this project's overrides and writes only the projects[root] entry (diff vs global); neither mode writes the other section
- [x] Re-run/amend semantics: no-flag re-runs amend the global answers; --project re-runs amend the project entry; accepting inherited defaults keeps existing overrides, setting a field back to the global value clears the override
- [x] Update HELP_TEXT + README; guidance renders from the merged config in both modes
- [x] verify resolution: no config (defaults), global-only, global + project overrides (project wins per field, boardRoot derived)
- [x] verify `kanbn-mcp setup --project` writes only the projects entry and leaves the global answers untouched (and a no-flag run leaves the project section untouched)
- [x] add tests for per-field merge precedence, override diff/clear, --project with no existing config, merged guidance rendering, legacy setup.json ignored, uninstall leaving the global config

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)
- [related-to make-kanbn-mcp-uninstall-and-check-deterministic-drop-written-registered-state-from-the-config](make-kanbn-mcp-uninstall-and-check-deterministic-drop-written-registered-state-from-the-config.md)
- [related-to setup-output-should-report-where-it-stores-files-mirroring-uninstall-s-removed-left-in-place-report](setup-output-should-report-where-it-stores-files-mirroring-uninstall-s-removed-left-in-place-report.md)
- [blocks add-a-per-project-board-path-to-home-kanbn-kanbn-mcp-config-json-replaces-kanbn-default-path](add-a-per-project-board-path-to-home-kanbn-kanbn-mcp-config-json-replaces-kanbn-default-path.md)

## Comments

- author: Kevin J. Duling
  date: 2026-10-18T12:00:00.000Z
  IMPLEMENTED (2026-10-18) with a board decision revision from the original spec: NO project-level .kanbn/kanbn-mcp-config.json - the user ruled that a project directory carries only board files. The per-project override from the original spec moved INSIDE the global file as a `projects` map keyed by absolute project root (exactly the shape the per-project board path ticket sketched for boardPath). Details in the description above. Code: src/setup/types.ts (SetupConfig: optional answers + projects map), src/setup/questions.ts (home-scoped configPath/readConfig/writeConfig, exported mergeAnswers/resolveAnswers/answersFor/projectOverrides - overrides are stored as a field-wise diff vs the global answers, so setting a field back to its global value clears the override), src/setup/index.ts (--project flag; setup writes exactly one section; guidance always renders the merged result; uninstall drops the config-removal step and reports 'Configuration left in place'). Docs: HELP_TEXT SETUP section + README. Legacy .kanbn/setup.json: clean break, ignored (pinned by test). Suite: 302/302 pass, lint 0 errors, tsc clean.

## History

- type: moved
  date: 2026-10-18T17:52:07.720Z
  fromColumn: Backlog
  toColumn: In Progress
  author: Kevin J. Duling
- type: progress
  date: 2026-10-18T18:21:14.060Z
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
- type: moved
  date: 2026-10-18T18:21:30.809Z
  fromColumn: In Progress
  toColumn: Done
  author: Kevin J. Duling
