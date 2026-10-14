---
progress: 1
tags:
  - feature
  - high
created: 2026-10-13T19:45:23.146Z
updated: 2026-10-14T20:33:45.350Z
started: 2026-10-14T19:09:45.847Z
completed: 2026-10-14T20:33:45.252Z
---

# kanbn-mcp install writes only per-host $HOME config; drop project-level registration

The agent-install artifacts - the MCP server registration and the host skill - must live in each host's $HOME location, never in the project. This is the install half of "behave like squeez", which registers per-host under $HOME.

Where each host currently lands (src/setup/hosts.ts):
  opencode  - PROJECT opencode.json/.jsonc is both first candidate and defaultPath -> WRONG, must move to ~/.config/opencode/opencode.json/.jsonc
  claude    - ~/.claude.json (home)                                           -> already correct
  cline     - ~/.cline/data/settings/cline_mcp_settings.json (home)            -> already correct
  windsurf  - ~/.codeium/windsurf/mcp_config.json (home)                       -> already correct
  copilot   - VS Code user mcp.json (home)                                     -> already correct

The host SKILL write already resolves to $HOME via globalSkillForHost (~/.config/opencode/skills, ~/.claude/skills, ~/.cline/skills, ~/.copilot/skills) - keep it there and make sure install never falls back to a project skill path.

Scope boundary: board-convention GUIDANCE files are `setup`'s job and stay project-level (repo AGENTS.md, CLAUDE.md, .clinerules/kanbn.md, .windsurf/rules/kanbn.md, committed skills/kanbn/SKILL.md, .github/skills/kanbn/SKILL.md). This ticket only moves the INSTALL writes (registration + host skill) under $HOME. Factory note: the opencode change means an existing project opencode.json entry should be cleaned up / not written.

Relates to fix-setup-mcp-registers-cline-at-the-legacy-global-storage-path (host config path correctness) and to setup-output-should-report-where-it-stores-files (the install report must name the real $HOME paths).

## Sub-tasks

- [x] Retarget opencode registration to ~/.config/opencode/opencode.json (prefer an existing .json/.jsonc there); never use project opencode.json
- [x] Audit every ClientRegistration candidates/defaultPath: assert all registration paths are under home; fix any project-level default
- [x] Confirm install's only skill writes are the $HOME global skills; install writes nothing under the board root
- [x] Keep setup's project-level guidance writes unchanged - explicitly out of scope here
- [x] Update HELP_TEXT + README to document the $HOME config paths per host
- [x] verify that `kanbn-mcp install` writes zero files under the board root
- [x] verify the opencode entry lands in ~/.config/opencode/opencode.json and `uninstall` removes it there
- [x] add a test asserting install performs no project-level write and that the opencode registration path is home-level

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)
- [related-to kanbn-mcp-install-and-uninstall-target-all-known-hosts-by-default-host-agent-limits-to-one](kanbn-mcp-install-and-uninstall-target-all-known-hosts-by-default-host-agent-limits-to-one.md)
- [related-to fix-setup-mcp-registers-cline-at-the-legacy-global-storage-path-instead-of-cline-data-settings](fix-setup-mcp-registers-cline-at-the-legacy-global-storage-path-instead-of-cline-data-settings.md)
- [related-to setup-output-should-report-where-it-stores-files-mirroring-uninstall-s-removed-left-in-place-report](setup-output-should-report-where-it-stores-files-mirroring-uninstall-s-removed-left-in-place-report.md)

## History

- type: moved
  date: 2026-10-14T19:09:45.847Z
  fromColumn: Backlog
  toColumn: In Progress
  author: Kevin J. Duling
- type: moved
  date: 2026-10-14T20:33:45.252Z
  fromColumn: In Progress
  toColumn: Done
  author: Kevin J. Duling
- type: progress
  date: 2026-10-14T20:33:45.350Z
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
