# kanbn-mcp

- [kanbn-mcp](#kanbn-mcp)
  - [Why this exists](#why-this-exists)
  - [Dependencies](#dependencies)
  - [Features](#features)
  - [Project structure](#project-structure)
  - [Installation](#installation)
    - [From npm](#from-npm)
    - [From source](#from-source)
  - [MCP client configuration](#mcp-client-configuration)
  - [Agent guidance with kanbn-mcp setup](#agent-guidance-with-kanbn-mcp-setup)
  - [Test](#test)
  - [Available tools](#available-tools)
  - [Example task metadata supported](#example-task-metadata-supported)
  - [Relationship to the Kanbn ecosystem](#relationship-to-the-kanbn-ecosystem)
  - [License](#license)
  - [Repository links](#repository-links)

A Model Context Protocol (MCP) server for working with Kanbn boards from AI assistants and other MCP clients.

This project wraps the Kanbn task and board APIs so tools like an LLM agent can inspect board state, initialize boards, create, delete, and archive tasks, and move tasks between columns without requiring direct shell access.

## Why this exists

Kanbn is a powerful markdown-based project board system. This project exposes a small, tool-based interface around that functionality so it can be used from MCP-compatible clients and automation.

## Dependencies

This project depends on the Kanbn library from:

- <https://github.com/basementuniverse/kanbn>

In this repo, that dependency is installed via npm as:

- `@basementuniverse/kanbn`

This project also works well alongside the optional VS Code extension from:

- <https://github.com/basementuniverse/vscode-kanbn>

That extension is not required for the MCP server to function, but it is useful if you want a first-party editor experience for the same Kanbn workflow in Visual Studio Code.

## Features

The MCP server currently exposes tools for:

- checking board status
- initializing a board
- ensuring a board exists
- creating tasks with Kanbn metadata
- editing existing tasks
- moving tasks between columns
- deleting tasks
- archiving tasks
- unarchiving tasks
- retrieving individual task details
- deleting entire boards

## Project structure

- `src/server.ts` — the MCP server implementation and tool handlers
- `src/setup/` — the `kanbn-mcp setup` and `kanbn-mcp install` commands: questions, canonical guidance renderer, per-client envelopes, MCP client registration, uninstall
- `skills/kanbn/SKILL.md` — the generic agent-facing skill shipped with the package
- `kanbn.d.ts` — type declarations for the Kanbn dependency
- `tests/kanbn-mcp.test.ts`, `tests/setup.test.ts` — unit tests covering commands, task field handling, and setup/install emission/registration

## Installation

### From npm

```bash
npm install -g @kduling/kanbn-mcp
```

This installs a `kanbn-mcp` binary on your PATH. Run `kanbn-mcp --help` to print usage and ready-to-paste configuration snippets.

**Two-step setup (recommended):**
```bash
kanbn-mcp install    # register MCP server + install global skills (no board questions)
kanbn-mcp setup      # guided board configuration (writes guidance files)
```

**Or combined (legacy):**
```bash
kanbn-mcp setup --mcp    # does both (deprecated; will be removed)
```

The binary runs as the MCP server by default; hosts that pass a subcommand-style argument can call `kanbn-mcp mcp` instead.

### From source

```bash
git clone git@github.com:kjduling/kanbn-mcp.git
cd kanbn-mcp
npm install
npm run build
```

From a source checkout, run the server with `node dist/server.js` and use the same configuration snippets below with `"command": "node"` and `"args": ["/path/to/kanbn-mcp/dist/server.js"]`.

## MCP client configuration

Point your MCP client at the `kanbn-mcp` command from the global install. The important parts are:

- `command`: `kanbn-mcp` (after `npm install -g @kduling/kanbn-mcp`)
- `args`: usually empty; `kanbn-mcp` accepts a literal `mcp` argument for hosts that expect a subcommand-style arg (e.g. `"args": ["mcp"]`); some hosts (e.g. Cline) expect a placeholder such as `[""]`

### opencode

```jsonc
// ~/.config/opencode/opencode.json
{
  "mcp": {
    "kanbn": {
      "type": "local",
      "command": ["kanbn-mcp"],
      "enabled": true
    }
  }
}
```

### Claude Desktop / other "mcpServers" hosts

```json
{
  "mcpServers": {
    "kanbn": {
      "command": "kanbn-mcp",
      "args": []
    }
  }
}
```

### Cline

Current Cline (extension, CLI, and SDK) reads one unified config at `~/.cline/data/settings/cline_mcp_settings.json`; the legacy VS Code extension path (`Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`) is migrated to it automatically and kept as a fallback.

Guidance-wise Cline reads project rules from `.clinerules/` at the workspace root, and skills from `.cline/skills/`, `.clinerules/skills/`, `.claude/skills/`, or `.agents/skills/`. A default `setup` writes the universal `AGENTS.md` block; if you want Cline's native project files as well, opt in with `setup --host=cline` (writes `.clinerules/kanbn.md` + `.cline/skills/kanbn/SKILL.md`), and `kanbn-mcp install` puts the board-neutral global skill at `~/.cline/skills/kanbn/SKILL.md` for detected hosts. Rules only apply to the folder you have open as the Cline workspace root — for guidance on other folders run `setup` in each project or rely on the global skill.

```json
{
  "mcpServers": {
    "kanbn": {
      "transport": {
        "type": "stdio",
        "command": "kanbn-mcp",
        "args": [""]
      }
    }
  }
}
```

Use the same pattern in any other MCP-compatible host such as a local editor or agent runtime.

### GitHub Copilot (VS Code)

VS Code's Copilot Chat integration reads one unified MCP config per user at `~/Library/Application Support/Code/User/mcp.json` (Linux: `~/.config/Code/User/mcp.json`; Windows: `%APPDATA%\Code\User\mcp.json`). `install --mcp` registers into it:

```json
{
  "servers": {
    "kanbn-mcp": {
      "command": "kanbn-mcp",
      "type": "stdio"
    }
  },
  "inputs": []
}
```

VS Code launches the server with the open workspace root as its working directory, so the board resolves per-project exactly as with the other clients — open/or set up the project containing `.kanbn` and Copilot manages that board. After registering, open Copilot Chat → model picker → MCP servers and enable **kanbn-mcp**. The project-scoped alternative is `.vscode/mcp.json` in the repo (same `servers` shape).

Copilot reads the board guidance the same way it reads everything else in a project:

- **`AGENTS.md`** at the workspace root — always-on, read automatically (the universal envelope, emitted by default).
- **`.github/skills/kanbn/SKILL.md`** — Copilot's workspace skill (`--host=copilot` emits it alongside `AGENTS.md`).
- **`~/.copilot/skills/kanbn/SKILL.md`** — Copilot's personal skill, installed by `kanbn-mcp install` for detected hosts, alongside the same run's `~/.cline/skills/` / `~/.config/opencode/skills/` global skills for the other clients.

### Which board does the server use?

With no extra configuration the server reads the board from its **working directory** — the directory the MCP host launches the server in. Open the host in your project root (the directory containing the `.kanbn` folder) and it manages that board. When the host launches the server from your home directory (common for a globally installed command), the server looks there instead.


Kanbn boards are markdown files; nothing stops a freshly launched agent from re-inventing the board's vocabulary (columns, tags, WIP limits). `kanbn-mcp setup` closes that loop: one short Q&A about how the board works, and the answers are written as AI-agnostic guidance into the files each client reads. Any agent that can see the repo — opencode, Claude, Windsurf, Cline, Devin, or a future one — knows the conventions before it touches a ticket.

**Separation of concerns:**
- `kanbn-mcp install` — wires the MCP server into AI client configs and installs global skills. No board questions.
- `kanbn-mcp setup` — board configuration Q&A + per-project guidance envelopes. No MCP registration or global skills.

```bash
# Step 1: install (one-time per machine/project)
kanbn-mcp install                    # all detected hosts
kanbn-mcp install --host=opencode    # one host only
kanbn-mcp install --mcp              # also register MCP server in client configs

# Step 2: setup (per project)
kanbn-mcp setup
```

The questions (all with defaults — Enter accepts, and re-runs amend rather than re-ask from scratch):

- board columns and what each means
- type tags: `bug` / `feature` / `documentation` / `spike` (each with a description)
- priority tags: `critical` / `high` / `medium` / `low`
- tag style: `typ:bug` / `pri:critical` prefixes, or plain `bug` / `critical`
- enforce type/priority tags on every ticket, or guide-only (default)
- WIP limits per column (default: none)
- custom fields (`name:type[:required]`, default: none)
- mirror directed relations on both tasks (depends-on ⇄ blocks, duplicate-of ⇄ duplicated-by; default on)

The answers render into **one canonical guidance body**, written to the project's **`AGENTS.md`** (guarded block) — the one universal file every agent reads. A default `setup` writes nothing else into the project: no dot-directories for agents that may not be in use. Per-host project files are opt-in via `--host=<slug>`:

| File | Readers | Opt-in via |
| --- | --- | --- |
| `AGENTS.md` (guarded block) | universal — every agent | default, always |
| `.opencode/skills/kanbn/SKILL.md` | opencode project skill | `--host=opencode` |
| `CLAUDE.md` (guarded block) | Claude Code | `--host=claude` |
| `.clinerules/kanbn.md` + `.cline/skills/kanbn/SKILL.md` | Cline rules + project skill | `--host=cline` |
| `.windsurf/rules/kanbn.md` | Windsurf | `--host=windsurf` |
| `.github/skills/kanbn/SKILL.md` | GitHub Copilot workspace skill | `--host=copilot` |
| `.cursor/rules/kanbn.md` + `.cursor/skills/kanbn/SKILL.md` | Cursor | `--host=cursor` |
| `.continue/rules/kanbn.md` | Continue | `--host=continue` |
| `.roo/rules/kanbn.md` | Roo Code | `--host=roo` |
| `.aider/kanbn.md` | Aider | `--host=aider` |
| `.gemini/rules/kanbn.md` | Gemini CLI | `--host=gemini-cli` |
| `.codex/rules/kanbn.md` | Codex | `--host=codex` |

The per-user side lives in `$HOME` and is `install`'s job: board-neutral global skills for **detected hosts only** (`~/.config/opencode/skills/kanbn/SKILL.md`, `~/.claude/skills/kanbn/SKILL.md`, `~/.cline/skills/kanbn/SKILL.md`, `~/.copilot/skills/kanbn/SKILL.md`). Nothing is ever written for an agent that isn't installed.

Answers persist to `$HOME/.kanbn/kanbn-mcp-config.json` as **configuration only** — no install log, and no config file inside the project itself (a board holds only board files). The file carries the global default answers plus per-project overrides keyed by the project root; resolution is per-field (`defaults ← global answers ← project overrides`). Re-runs amend instead of duplicating, and `kanbn-mcp uninstall` recomputes everything it should remove from that config plus host detection (nothing to go stale) while deliberately leaving the config itself behind.

### Flags for `kanbn-mcp setup`

| Flag | Effect |
| --- | --- |
| `--yes` | non-interactive: accept defaults (or amend persisted answers) |
| `--json <file>` | import answers from a JSON file (non-interactive) |
| `--project` | amend this project's overrides in the global config, seeded from the global defaults; the global answers and the project section never write each other |
| `--host=<slugs>` | additionally emit that host's own project file (comma-separated: `opencode\|claude\|windsurf\|cline\|devin\|copilot\|cursor\|continue\|roo\|aider\|gemini-cli\|codex`); `AGENTS.md` is written either way |
| `--repo-only` | write repo files only (the default) |
| `--list` | list detected clients and target files; change nothing |
| `--dry-run` | show what would be written; change nothing |
| `--print` | print the canonical guidance + manual install instructions for any client; change nothing |
| `--check` | report the recomputed guidance targets from the config (read-only; no state file) |

The canonical body is client-neutral — it names only kanbn-mcp MCP tools, never a specific AI. `kanbn-mcp setup --print` gives copy-paste install instructions for any client, including ones setup does not know about (e.g. a future host): point its MCP config at the `kanbn-mcp` command and drop the printed prose into wherever that client reads rules.

### Flags for `kanbn-mcp install`

| Flag | Effect |
| --- | --- |
| `--mcp[=clients]` | register the kanbn MCP server in detected client configs — `~/.config/opencode/opencode.json` (opencode), `~/.claude.json` (Claude Code), `~/.cline/data/settings/cline_mcp_settings.json` (Cline), `~/.codeium/windsurf/mcp_config.json` (Windsurf), VS Code user `mcp.json` (GitHub Copilot); limit with a comma list, e.g. `--mcp=opencode,claude` |
| `--host=<slugs>` | install global skill + MCP registration for `opencode\|claude\|cline\|copilot` (comma-separated) into their respective home configs; if omitted, installs for **all detected hosts** |
| `--list` | list detected clients and target files; change nothing |
| `--dry-run` | show what would be written; change nothing |
| `--check` | report current install state |

### Flags for `kanbn-mcp uninstall`

| Flag | Effect |
| --- | --- |
| `--host=<slugs>` | uninstall only the specified hosts (comma-separated); if omitted, uninstalls **all hosts** |
| `--check` | report current install state (alias for `install --check`) |

### Non-interactive runs (CI)

`--yes` writes guidance with the defaults; `--json` imports a partial answers file — anything omitted falls back to defaults:

```json
{
  "tagStyle": "plain",
  "wipLimits": { "In Progress": 3 },
  "customFields": [{ "name": "severity", "type": "string", "required": true }]
}
```

### Installing the shipped skill by hand

The npm package ships a generic skill at `skills/kanbn/SKILL.md`. To install it globally without `--host`, copy it into place:

- opencode: `~/.config/opencode/skills/kanbn/SKILL.md`
- Claude: `~/.claude/skills/kanbn/SKILL.md`
- any other skill-reading client: its own skills directory

### Removing

`kanbn-mcp uninstall` removes every guidance block and registration `kanbn-mcp install` or `kanbn-mcp setup` wrote. It recomputes its target set from the resolved board config plus host detection — there is no stored manifest to go stale — and still guards every write: it leaves user-authored content alone and will not remove a client config entry it did not create.

## Test

```bash
npm test
```

## Available tools

| Tool | Description |
| ------------------------ | ---------------------------------------------------- |
| `kanbn_status` | Check the current status of the Kanbn board |
| `kanbn_init_board` | Initialize a new Kanbn board |
| `kanbn_initialize_board` | Alias for `kanbn_init_board` |
| `kanbn_ensure_board` | Ensure a Kanbn board exists, initializing if absent |
| `kanbn_create_task` | Create a new task with metadata |
| `kanbn_delete_task` | Delete a task from the board (supports `force` flag) |
| `kanbn_archive_task` | Archive a task on the board |
| `kanbn_get_task` | Retrieve details of a specific task |
| `kanbn_edit_task` | Edit an existing task on the board |
| `kanbn_move_task` | Move a task between columns |
| `kanbn_rename_task` | Rename a task (returns the new task id) |
| `kanbn_delete_board` | Delete an entire board directory |
| `kanbn_unarchive_task` | Unarchive a task on the board |
| `kanbn_restore_task` | Alias for `kanbn_unarchive_task` |
| `kanbn_find_simple_tasks` | Find simple tasks by title (or all on the board) |
| `kanbn_get_simple_task` | Resolve exactly one simple task by title |
| `kanbn_move_simple_task` | Move a simple task to another column |
| `kanbn_move_simple_task_to_board` | Move a simple task onto another board |
| `kanbn_delete_simple_task` | Remove a simple task from the board |
| `kanbn_promote_simple_task` | Convert a simple task into a real task file |
| `kanbn_create_board` | Create a new secondary board |
| `kanbn_delete_board_file` | Delete a secondary board file, returning orphaned task IDs |
| `kanbn_rename_board` | Rename a secondary board (slug and/or name) |
| `kanbn_list_boards` | List all boards in the workspace |
| `kanbn_boards_summary` | Summary of each board with task statistics |
| `kanbn_board_exists` | Check whether a board exists |
| `kanbn_reserved_board_slugs` | List reserved board slugs |
| `kanbn_validate_board_slug` | Validate a board slug (throws on invalid/reserved) |
| `kanbn_find_orphaned_tasks` | Find tasks only referenced by one board |
| `kanbn_cross_board_tasks` | Find tasks appearing on more than one board |
| `kanbn_tasks_on_other_boards` | Map each task to other boards referencing it |
| `kanbn_sort_column` | Sort a board column (name/created/modified/due/assigned/progress) |
| `kanbn_comment` | Add a comment to a task |
| `kanbn_get_config` | Get the Kanbn config, or null if none exists |
| `kanbn_save_config` | Save the Kanbn config to a config file |
| `kanbn_get_action_rules` | Get the resolved action rules for the board |
| `kanbn_find_action_warnings` | Get potential issues with the action rules |
| `kanbn_get_date_format` | Get the board's date format string |
| `kanbn_get_task_template` | Get the board's task template string |
| `kanbn_get_workspace_options` | Get workspace-scoped Kanbn options |
| `kanbn_validate_board` | Validate the board (true or list of parsing errors) |
| `kanbn_search` | Search tasks with filters (tag, assigned, due, etc.) across all columns |
| `kanbn_get_contributors` | Get the workspace's normalised contributors |
| `kanbn_find_contributor` | Match a value to a contributor (name, display name, aliases) |
| `kanbn_current_user` | Resolve the current user (KANBN_USER, then git identity) |
| `kanbn_collect_contributor_values` | Collect every assigned/author value in use |
| `kanbn_contributor_usage` | Contributor usage stats with spelling variants |
| `kanbn_contributor_warnings` | Unknown contributor warnings |
| `kanbn_burndown` | Burndown chart data (sprints, dates, assigned, columns, normalise) |
| `kanbn_start_sprint` | Start a new sprint (optional name, description, start date) |
| `kanbn_list_archived_tasks` | List archived task ids |
| `kanbn_load_archived_task` | Load a task from the archive |
| `kanbn_add_untracked_task` | Add an untracked task file to a column in the index |
| `kanbn_find_tracked_tasks` | List tracked task IDs (optionally filtered by column) |
| `kanbn_find_untracked_tasks` | List task files that aren't in the index |
| `kanbn_find_missing_task_files` | Find indexed tasks whose file is missing |
| `kanbn_add_task_to_board` | Add an existing task file to this board |
| `kanbn_find_task_boards` | Find which boards and columns reference a task |
| `kanbn_task_file_exists` | Check whether a task file exists |
| `kanbn_task_exists` | Check that a task file exists and is indexed |
| `kanbn_find_task_column` | Find the column a task is in |
| `kanbn_remove_all` | Delete the whole board (requires confirm: true) |

## Example task metadata supported

The MCP wrapper supports common Kanbn task fields including:

- `name`
- `column`
- `description`
- `assigned`
- `due`
- `started`
- `completed`
- `progress`
- `plannedStart`
- `plannedFinish`
- `created`
- `updated`
- `tags`
- `subTasks`
- `comments`
- `relations` (see known issues — not yet a declared schema property)
- custom metadata via `metadata`

## Tips for AI agents

This server is used heavily by LLM-driven agents, so a few behaviours matter more than they look:

### Sub-tasks go in `subTasks`, not `description`

A task's break-down lives in the `subTasks` field — pass it to `kanbn_create_task` / `kanbn_edit_task` as an array of strings (or `{text, completed}` objects). A bulleted "Sub-tasks:" list inside `description` is invisible to the board: it won't render as checkboxes, be tracked, or be counted by `kanbn_search`.

The same shape applies at creation time. Create tickets with `subTasks` and `relations` filled in from the start rather than bolting them on later — `kanbn_edit_task` replaces (does not merge) whole collections.

### Verify after every create/edit

Task files are plain markdown and `kanbn_edit_task` writes each array wholesale, so a stale or abbreviated argument list can silently drop data. Rule of thumb: after `kanbn_create_task` or `kanbn_edit_task`, follow up with `kanbn_get_task` (or `kanbn_status`) and confirm the fields you intended, especially `subTasks`/`relations` arrays.

## Known issues

- **`kanbn_edit_task` replaces whole collections rather than merging.** `relations`, `subTasks` and `comments` are written as the exact array you supply. Passing one new relation to a task that has three silently drops the other two. Workaround today: `kanbn_get_task` first, re-supply the full arrays, then re-verify.
- **`relations` is not yet a declared tool parameter.** The Kanbn model stores relations (`{task, type}[]`, e.g. `depends-on`/`blocks`) and this server will persist them, but until first-class relation tooling lands treat them as best-effort/undocumented.

## Relationship to the Kanbn ecosystem

This repo is intentionally a thin layer over the Kanbn runtime:

- Kanbn provides the underlying board/task model and file storage
- kanbn-mcp provides an MCP-compatible interface for agents and tools
- the VS Code extension provides a GUI/editor experience for the same ecosystem

Together, they provide a consistent Kanbn workflow across terminal, editor, and AI tooling.

## License

MIT

## Repository links

- Kanbn: <https://github.com/basementuniverse/kanbn>
- VS Code extension: <https://github.com/basementuniverse/vscode-kanbn>