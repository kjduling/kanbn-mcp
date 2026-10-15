---
progress: 1
tags:
  - feature
  - high
created: 2026-10-13T20:01:48.265Z
updated: 2026-10-15T01:54:29.204Z
started: 2026-10-15T01:38:23.846Z
completed: 2026-10-15T01:54:29.170Z
---

# Make kanbn-mcp uninstall and --check deterministic; drop written/registered state from the config

The persisted write manifest in .kanbn/setup.json (the `written` array, and `registered`) causes real pain: it goes stale, it couples `uninstall` to a mutation log, and it wants to track files the user never asked it to own - e.g. the board-guidance block injected into /Users/kevin/Dev/AGENTS.md got caught up in the "written" bookkeeping. Dropping it is the goal.

Board decision (2026-10-13): remove ALL persisted install state. The config file becomes pure configuration (columns, tags, and the other board conventions) - no `written`, no `registered`, no generatedAt state. `uninstall` and `--check` RECOMPUTE their target set deterministically from the resolved (global + project) config plus host detection, and act only on marker-guarded generated content.

Consequence: uninstall no longer replays a log; it re-derives the same goal-state setup would produce and reverses it. `--check` runs the same derivation read-only. Foreign / hand-edited content is left in place (the existing marker guard already does this - keep it).

Pairs with the "global config + per-field project override" ticket: that one defines WHERE the config lives and how it merges; this one removes the state that merge has to stop carrying.

Supersedes part of the split ticket (split-kanbn-mcp-setup-into-install-and-setup), whose sub-task was to "split or namespace the .kanbn/setup.json manifest" - with no manifest there is nothing to split.

## Sub-tasks

- [x] Remove `written` and `registered` from the config types + read/write path; the file carries configuration only
- [x] Rework runUninstall to recompute repo-guidance targets (from the merged config + host selection) and host registrations (from detectHosts) instead of reading a manifest
- [x] Rework --check to report the recomputed, read-only target set with no state file
- [x] Keep the marker guard: only generated blocks/files are removed; hand-edited or foreign content is reported under 'Left in place:'
- [x] Keep the Removed:/Left in place: report shape verbatim; it now reflects computed targets, and drop the 'Stored manifest:' line
- [x] Update HELP_TEXT + README: no manifest is stored; uninstall/--check are derived
- [x] verify that uninstall fully reverses a setup with no state file present
- [x] verify that --check reports the correct target set with no state file
- [x] verify that a hand-edited guidance block is left in place with a note
- [x] add a regression test: run setup, delete any state, then uninstall still removes everything generated
- [x] add a test that a second uninstall run is a clean no-op (idempotent)

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)
- [related-to move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override](move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override.md)

## Comments

- author: Kevin J. Duling
  date: 2026-10-15T01:54:25.690Z
  Implemented (2026-10-14). The persisted write manifest is gone: `SetupManifest` (written/registered/generatedAt) becomes `SetupConfig` ({ schemaVersion, answers }) - pure configuration. questions.ts: manifestPath/readManifest/writeManifest -> configPath/readConfig/writeConfig.
  
  uninstall and setup --check no longer replay a log. They recompute the target set from the board config (or defaults when the config is missing) + host detection: repo guidance via planRepoEmit, global skills via the per-host global skill paths, and MCP registrations across EVERY candidate path per client (so a registration left in a stale layout is still cleaned).
  
  Guards kept: the marker guard (managed blocks via BLOCK_START/BLOCK_END, whole files via FILE_MARKER) and the client entry-shape guard still decide what is ours; hand-edited/foreign content is reported under 'Left in place:'. install no longer writes any config/manifest, and cleans stale candidate paths deterministically instead of from the manifest. Dropped the 'Stored manifest:' line from the setup report.
  
  Tests: 296/296 pass. New: uninstall still removes generated guidance after the config is deleted (state-loss regression); second uninstall is a clean no-op; hand-edited block is left in place with a note; --check reports the recomputed target set (no 'written:'). Updated existing e2e expectations (no manifest assertions; runUninstall now takes an injected home). Docs: README + HELP_TEXT updated. tsc clean, eslint 0 errors.

## History

- type: moved
  date: 2026-10-15T01:38:23.846Z
  fromColumn: Backlog
  toColumn: In Progress
  author: Kevin J. Duling
- type: progress
  date: 2026-10-15T01:54:19.045Z
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
- type: moved
  date: 2026-10-15T01:54:29.170Z
  fromColumn: In Progress
  toColumn: Done
  author: Kevin J. Duling
