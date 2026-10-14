---
tags:
  - feature
  - high
created: 2026-10-13T19:38:12.693Z
updated: 2026-10-14T05:30:00.000Z
started: 2026-10-14T04:30:00.000Z
completed: 2026-10-14T05:30:00.000Z
progress: 1
---

# Split kanbn-mcp setup into install and setup

`kanbn-mcp setup` currently does two unrelated jobs in one command:

1. Board configuration — the interactive Q&A (columns + meanings, type/priority tag vocabulary, tag style, WIP limits, custom fields, relation mirroring) and emission of the canonical client-neutral guidance body into per-client envelopes (AGENTS.md, .opencode/skills/kanbn/SKILL.md, CLAUDE.md, .clinerules/kanbn.md, .windsurf/rules/kanbn.md, committed skills/kanbn/SKILL.md).
2. Per-agent installation — `--mcp` registers the kanbn MCP server in detected client configs (opencode.json, ~/.claude.json, cline_mcp_settings.json, ~/.codeium/windsurf/mcp_config.json, VS Code user mcp.json), and `--host` additionally installs the global skill per client (~/.config/opencode/skills, ~/.claude/skills, ~/.cline/skills, ~/.copilot/skills).

The two are independent: a user may want to wire the MCP server without answering board questions, or configure the board without touching client configs. Bundling them means setup always walks the Q&A before it can install, and re-running for one concern re-runs the other.

Split into two commands:

- `kanbn-mcp install` — per-agent wiring only: detect hosts, register the kanbn MCP server in client configs, install/refresh global skills. No board Q&A, no guidance emission.
- `kanbn-mcp setup` — board configuration only: the Q&A + emit the per-client guidance envelopes. No client registration.

Both must keep working with the shared write-manifest in .kanbn/setup.json and `kanbn-mcp uninstall`, which reverses everything either command wrote.

Related: the Done ticket add-kanbn-mcp-setup-interactive-guided-configuration-squeez-unity-cli-style deliberately scoped client registration INTO setup; this ticket reverses that decision and re-homes it on install. Also relates to setup-output-should-report-where-it-stores-files-mirroring-uninstall-s-removed-left-in-place-report (each command's report should reflect only what it wrote).

Effort: src/setup/index.ts (runSetup) currently interleaves both flows (lines ~314-411); parseSetupArgs + server.ts dispatch (positional 'setup'/'uninstall') need an 'install' branch and per-command flag sets.

## Sub-tasks

- [x] Decide the flag/scope split: which flags move to install (--mcp, --host, --list, --check?) vs setup (--yes, --json, --repo-only, --host?, --print, --dry-run), and keep uninstall covering both
- [x] Extract the per-agent install flow (detectHosts/registerClient/global skill writes) out of runSetup into a runInstall entry point
- [x] Reduce runSetup to board configuration + guidance emission only; remove client registration from its path
- [x] Add the 'install' subcommand dispatch in src/server.ts alongside setup/uninstall, without breaking the bare-server and 'mcp' positional paths
- [x] Update HELP_TEXT and README: document install and setup as separate commands with their own flag lists
- [x] verify that `kanbn-mcp install` registers the MCP server without asking board questions or writing guidance files
- [x] verify that `kanbn-mcp setup` emits guidance without registering any MCP client
- [x] verify that `kanbn-mcp uninstall` removes everything written by either install or setup (deterministic, no manifest)
- [x] add a test for install-only runs (registration, no guidance writes) and setup-only runs (guidance writes, no registration)
- [x] add a test that feature-flagged behaviour is idempotent across re-runs of either command

## Relations

- [related-to make-kanbn-mcp-uninstall-and-check-deterministic-drop-written-registered-state-from-the-config](make-kanbn-mcp-uninstall-and-check-deterministic-drop-written-registered-state-from-the-config.md)
- [related-to move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override](move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override.md)
- [related-to kanbn-mcp-install-and-uninstall-target-all-known-hosts-by-default-host-agent-limits-to-one](kanbn-mcp-install-and-uninstall-target-all-known-hosts-by-default-host-agent-limits-to-one.md)
- [related-to kanbn-mcp-install-writes-only-per-host-home-config-drop-project-level-registration](kanbn-mcp-install-writes-only-per-host-home-config-drop-project-level-registration.md)
- [related-to ensure-skill-files-are-installed-to-correct-directories-for-each-agent-host](ensure-skill-files-are-installed-to-correct-directories-for-each-agent-host.md)
- [related-to clean-up-the-setup-prompt-layout-break-wordy-single-line-questions-and-defaults-onto-readable-lines](clean-up-the-setup-prompt-layout-break-wordy-single-line-questions-and-defaults-onto-readable-lines.md)

## Comments

- author: Kevin J. Duling
  date: 2026-10-13T20:02:04.974Z
  Manifest sub-task superseded (2026-10-13): the .kanbn/setup.json write-manifest is being removed entirely (written + registered state), so there is no manifest to 'split or namespace' between install and setup. Uninstall/--check become deterministic (recompute targets from config + host detection). See tickets: 'Make kanbn-mcp uninstall and --check deterministic; drop written/registered state from the config' and 'Move board config to $HOME/.kanbn/kanbn-mcp-config.json with per-field project override'.
