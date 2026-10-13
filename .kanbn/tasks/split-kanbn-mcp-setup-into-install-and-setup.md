---
tags:
  - feature
  - high
created: 2026-10-13T19:38:12.693Z
updated: 2026-10-13T22:06:15.652Z
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

- [ ] Decide the flag/scope split: which flags move to install (--mcp, --host, --list, --check?) vs setup (--yes, --json, --repo-only, --host?, --print, --dry-run), and keep uninstall covering both
- [ ] Extract the per-agent install flow (detectHosts/registerClient/global skill writes) out of runSetup into a runInstall entry point
- [ ] Reduce runSetup to board configuration + guidance emission only; remove client registration from its path
- [ ] Add the 'install' subcommand dispatch in src/server.ts alongside setup/uninstall, without breaking the bare-server and 'mcp' positional paths
- [ ] Split or namespace the .kanbn/setup.json manifest so uninstall reverses both commands' writes and each command's report shows only its own targets
- [ ] Update HELP_TEXT and README: document install and setup as separate commands with their own flag lists
- [ ] verify that `kanbn-mcp install` registers the MCP server without asking board questions or writing guidance files
- [ ] verify that `kanbn-mcp setup` emits guidance without registering any MCP client
- [ ] verify that `kanbn-mcp uninstall` removes everything written by either install or setup
- [ ] add a test for install-only runs (registration, no guidance writes) and setup-only runs (guidance writes, no registration)
- [ ] add a test that feature-flagged behaviour is idempotent across re-runs of either command

## Relations

- [related-to add-kanbn-mcp-setup-interactive-guided-configuration-squeez-unity-cli-style](add-kanbn-mcp-setup-interactive-guided-configuration-squeez-unity-cli-style.md)
- [related-to setup-output-should-report-where-it-stores-files-mirroring-uninstall-s-removed-left-in-place-report](setup-output-should-report-where-it-stores-files-mirroring-uninstall-s-removed-left-in-place-report.md)

## Comments

- author: Kevin J. Duling
  date: 2026-10-13T20:02:04.974Z
  Manifest sub-task superseded (2026-10-13): the .kanbn/setup.json write-manifest is being removed entirely (written + registered state), so there is no manifest to 'split or namespace' between install and setup. Uninstall/--check become deterministic (recompute targets from config + host detection). See tickets: 'Make kanbn-mcp uninstall and --check deterministic; drop written/registered state from the config' and 'Move board config to $HOME/.kanbn/kanbn-mcp-config.json with per-field project override'.
