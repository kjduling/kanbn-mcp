---
tags:
  - feature
  - high
created: 2026-10-13T20:25:46.454Z
updated: 2026-10-13T22:01:03.992Z
---

# ensure-skill-files-are-installed-to-correct-directories-for-each-agent-host

Currently kanbn-mcp setup installs the kanbn skill as SKILL.md to OpenCode's skills/kanbn/ directory. Different agents expect skills/rules in different locations and sometimes different filenames (SKILL.md vs SKILLS.md, .mdc files, etc.). We need to ensure the setup/install flow places the skill file in the correct location(s) for each supported agent host.

This includes:
- Documenting correct skill/rule locations per host (OpenCode, Claude Code, Cursor, Continue, Cline/RooCode, Aider, GitHub Copilot, Gemini CLI, Codex, etc.)
- Updating setup/install logic to write to appropriate paths based on --host or detected host
- Ensuring uninstall removes files from all targeted locations
- Updating docs/AGENTS.md to clarify correct placement and naming conventions

## Sub-tasks

- [ ] Inventory known agent skill/rule locations and filenames
- [ ] Update setup/install to resolve correct output path per host
- [ ] Support common hosts: opencode, claude-code, cursor, continue, cline, roo, aider, copilot, gemini-cli, codex
- [ ] Update AGENTS.md/docs to document correct placement
- [ ] Add tests for per-host path resolution
- [ ] Add acceptance tests verifying files go to correct dirs
- [ ] Verify uninstall removes files from all targeted locations

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)
