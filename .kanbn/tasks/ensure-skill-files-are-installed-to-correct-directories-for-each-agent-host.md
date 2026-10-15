---
created: 2026-10-13T20:25:46.454Z
updated: 2026-10-15T00:02:12.037Z
tags:
  - feature
  - high
completed: 2026-10-15T00:02:12.037Z
---

# ensure-skill-files-are-installed-to-correct-directories-for-each-agent-host

Currently kanbn-mcp setup installs the kanbn skill as SKILL.md to OpenCode's skills/kanbn/ directory. Different agents expect skills/rules in different locations and sometimes different filenames (SKILL.md vs SKILLS.md, .mdc files, etc.). We need to ensure the setup/install flow places the skill file in the correct location(s) for each supported agent host.

This includes:
- Documenting correct skill/rule locations per host (OpenCode, Claude Code, Cursor, Continue, Cline/RooCode, Aider, GitHub Copilot, Gemini CLI, Codex, etc.)
- Updating setup/install logic to write to appropriate paths based on --host or detected host
- Ensuring uninstall removes files from all targeted locations
- Updating docs/AGENTS.md to clarify correct placement and naming conventions

## Sub-tasks

- [x] Inventory known agent skill/rule locations and filenames
- [x] Update setup/install to resolve correct output path per host
- [x] Support common hosts: opencode, claude-code, cursor, continue, cline, roo, aider, copilot, gemini-cli, codex
- [x] Update AGENTS.md/docs to document correct placement
- [x] Add tests for per-host path resolution
- [x] Add acceptance tests verifying files go to correct dirs
- [x] Verify uninstall removes files from all targeted locations

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)

## History

- type: moved
  date: 2026-10-15T00:02:12.037Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
