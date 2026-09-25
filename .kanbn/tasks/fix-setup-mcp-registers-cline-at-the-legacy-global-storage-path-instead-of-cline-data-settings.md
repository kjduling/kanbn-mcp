---
tags:
  - 'typ:bug'
  - 'pri:high'
created: 2026-09-25T18:47:00.248Z
completed: 2026-09-25T18:47:00.248Z
---

# fix: setup --mcp registers Cline at the legacy globalStorage path instead of ~/.cline/data/settings

kanbn-mcp setup --mcp registered the kanbn MCP server into the legacy VS Code extension config (Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json). Current Cline (extension, CLI, SDK) reads one unified config at ~/.cline/data/settings/cline_mcp_settings.json and migrates the legacy file there, so the entry was written to a file nothing reads - invisible in Cline's MCP setup. Fixed in commit 04121f7 (released to nowhere yet; unpublished).

## Sub-tasks

- [x] Reproduce: run `kanbn-mcp setup --mcp --yes` on a Cline install that migrated to the modern layout - kanbn lands in the legacy globalStorage file and never appears in Cline's MCP server list.
- [x] Confirm the modern path (~/.cline/data/settings/cline_mcp_settings.json) is authoritative and that Cline accepts the transport-wrapped entry shape (it matches the real unity entry in the live config).
- [x] Add tests: registerClient prefers the modern ~/.cline config over the legacy file when both exist, and leaves the legacy file untouched.
- [x] Add a test for re-run path changes: an earlier registration at a different path is re-registered at the new one and the stale entry is cleaned up so uninstall stays complete.
- [x] Clean up an in-repo setup run that overwrote skills/kanbn/SKILL.md and opencode.json (restored to committed state).

## Comments

- author: jinx
  date: 2026-09-25T18:40:00.000Z
  Fixed and verified live: re-running setup moved the kanbn entry into the real ~/.cline/data/settings/cline_mcp_settings.json (next to squeez, unity, unity-mcp) and removed it from the legacy file without touching unity. Committed 04121f7; publish/1.2.1 on hold.

## History

- type: created
  date: 2026-09-25T18:47:00.248Z
  column: Done
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
