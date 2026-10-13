---
tags:
  - feature
  - high
created: 2026-10-13T20:01:48.265Z
updated: 2026-10-13T22:01:04.077Z
---

# Make kanbn-mcp uninstall and --check deterministic; drop written/registered state from the config

The persisted write manifest in .kanbn/setup.json (the `written` array, and `registered`) causes real pain: it goes stale, it couples `uninstall` to a mutation log, and it wants to track files the user never asked it to own - e.g. the board-guidance block injected into /Users/kevin/Dev/AGENTS.md got caught up in the "written" bookkeeping. Dropping it is the goal.

Board decision (2026-10-13): remove ALL persisted install state. The config file becomes pure configuration (columns, tags, and the other board conventions) - no `written`, no `registered`, no generatedAt state. `uninstall` and `--check` RECOMPUTE their target set deterministically from the resolved (global + project) config plus host detection, and act only on marker-guarded generated content.

Consequence: uninstall no longer replays a log; it re-derives the same goal-state setup would produce and reverses it. `--check` runs the same derivation read-only. Foreign / hand-edited content is left in place (the existing marker guard already does this - keep it).

Pairs with the "global config + per-field project override" ticket: that one defines WHERE the config lives and how it merges; this one removes the state that merge has to stop carrying.

Supersedes part of the split ticket (split-kanbn-mcp-setup-into-install-and-setup), whose sub-task was to "split or namespace the .kanbn/setup.json manifest" - with no manifest there is nothing to split.

## Sub-tasks

- [ ] Remove `written` and `registered` from the config types + read/write path; the file carries configuration only
- [ ] Rework runUninstall to recompute repo-guidance targets (from the merged config + host selection) and host registrations (from detectHosts) instead of reading a manifest
- [ ] Rework --check to report the recomputed, read-only target set with no state file
- [ ] Keep the marker guard: only generated blocks/files are removed; hand-edited or foreign content is reported under 'Left in place:'
- [ ] Keep the Removed:/Left in place: report shape verbatim; it now reflects computed targets, and drop the 'Stored manifest:' line
- [ ] Update HELP_TEXT + README: no manifest is stored; uninstall/--check are derived
- [ ] verify that uninstall fully reverses a setup with no state file present
- [ ] verify that --check reports the correct target set with no state file
- [ ] verify that a hand-edited guidance block is left in place with a note
- [ ] add a regression test: run setup, delete any state, then uninstall still removes everything generated
- [ ] add a test that a second uninstall run is a clean no-op (idempotent)

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)
- [related-to move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override](move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override.md)
