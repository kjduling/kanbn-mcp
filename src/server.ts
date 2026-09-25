#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, CallToolResult, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";
import { resetOperationQueue } from "./kanbn/queue.js";
import { handleToolCall, listTools } from "./tools/index.js";
import { findFirstPositional, runSetup, runUninstall } from "./setup/index.js";

// Public API surface. The tool implementations live in per-category modules (src/tools/*),
// the shared Kanbn helpers in src/kanbn/*; this entry file only wires them to the MCP server.
export * from "./tools/board.js";
export * from "./tools/task.js";
export * from "./tools/simpleTasks.js";
export * from "./tools/config.js";
export * from "./tools/analytics.js";
export * from "./tools/contributors.js";
export * from "./tools/maintenance.js";
export * from "./tools/sprint.js";
export * from "./tools/index.js";
export * from "./kanbn/instance.js";
export * from "./kanbn/queue.js";
export * from "./kanbn/taskData.js";
export * from "./kanbn/response.js";
export * from "./kanbn/args.js";
export * from "./kanbn/schema.js";
export * from "./types.js";

export const { version } = require("../package.json");

const server = new Server(
    {
        name: "kanbn-mcp",
        version: version,
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return listTools();
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    return handleToolCall(name, args) as unknown as CallToolResult;
});

export const HELP_TEXT = `kanbn-mcp ${version} - A Model Context Protocol server for Kanbn board management

USAGE
  kanbn-mcp [options]                  after: npm install -g @kduling/kanbn-mcp
  npx -y @kduling/kanbn-mcp [options]  run without installing
  kanbn-mcp mcp [options]              explicit server mode: some MCP hosts
                                       pass a literal 'mcp' argument
  kanbn-mcp setup [flags]              guided board configuration for AI clients
  kanbn-mcp uninstall                  remove what setup wrote
  node dist/server.js [options]        from a source checkout

OPTIONS
  -h, --help       Show this help message
  -v, --version    Print the version number
  --run-server     Start the MCP server even when the entry script is not
                   named 'server' (e.g. launches via npx or a renamed build)

Run with no options to start the MCP server over stdio. The server also
starts when the entry script's filename contains "server", when a literal
'mcp' positional argument is present, or when --run-server is passed.

ENVIRONMENT
  KANBN_DEFAULT_PATH   Optional. Default board directory (must contain a .kanbn
                       folder). If unset, the server resolves the board from its
                       working directory - usually the directory the MCP host
                       launched the server from (often the project root you have
                       open, or the home directory for a global launch).
                       Individual tools can override this per-call with a "path"
                       argument.

LIMITATION
  operationQueue serializes ops within a single session. No concurrent connections.
  If multiple connections arise, a per-connection queue would be required.

TOOLS
  kanbn_status, kanbn_init_board, kanbn_initialize_board, kanbn_ensure_board,
  kanbn_create_task, kanbn_edit_task, kanbn_move_task, kanbn_rename_task,
  kanbn_delete_task,
  kanbn_archive_task, kanbn_unarchive_task, kanbn_restore_task,
  kanbn_get_task, kanbn_delete_board,
  kanbn_find_simple_tasks, kanbn_get_simple_task, kanbn_move_simple_task,
  kanbn_move_simple_task_to_board, kanbn_delete_simple_task,
  kanbn_promote_simple_task,
  kanbn_create_board, kanbn_delete_board_file, kanbn_rename_board,
  kanbn_list_boards, kanbn_boards_summary, kanbn_board_exists,
  kanbn_reserved_board_slugs, kanbn_validate_board_slug,
  kanbn_find_orphaned_tasks, kanbn_cross_board_tasks, kanbn_tasks_on_other_boards,
  kanbn_sort_column, kanbn_comment,
  kanbn_get_config, kanbn_save_config, kanbn_get_action_rules,
  kanbn_find_action_warnings, kanbn_get_date_format, kanbn_get_task_template,
  kanbn_get_workspace_options, kanbn_validate_board, kanbn_search,
  kanbn_get_contributors, kanbn_find_contributor, kanbn_current_user,
  kanbn_collect_contributor_values, kanbn_contributor_usage, kanbn_contributor_warnings,
  kanbn_burndown, kanbn_list_archived_tasks, kanbn_load_archived_task, kanbn_start_sprint,
  kanbn_add_untracked_task, kanbn_find_tracked_tasks, kanbn_find_untracked_tasks,
  kanbn_find_missing_task_files, kanbn_add_task_to_board, kanbn_find_task_boards,
  kanbn_task_file_exists, kanbn_task_exists, kanbn_find_task_column, kanbn_remove_all

MCP CLIENT CONFIGURATION

  Install the MCP server first:

    npm install -g @kduling/kanbn-mcp

  opencode (project or ~/.config/opencode/opencode.json / opencode.jsonc):

    {
      "mcp": {
        "kanbn": {
          "type": "local",
          "command": ["kanbn-mcp"],
          "enabled": true
        }
      }
    }

  Claude Desktop / other "mcpServers" hosts (e.g. claude_desktop_config.json):

    {
      "mcpServers": {
        "kanbn": {
          "command": "kanbn-mcp",
          "args": []
        }
      }
    }

  Cline (cline_mcp_settings.json):

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

  Some hosts expect one subcommand-style argument. kanbn-mcp accepts a
  literal 'mcp' argument for those hosts, e.g. "args": ["mcp"].

  In all cases the board root (the directory containing .kanbn) is taken from
  the server's working directory, so each project configures its own board.
  To force a fixed board regardless of working directory, add an optional
  environment entry:

    opencode:     "environment": { "KANBN_DEFAULT_PATH": "/path/to/project-root" }
    mcpServers:   "env": { "KANBN_DEFAULT_PATH": "/path/to/project-root" }

  KANBN_DEFAULT_PATH is optional and should point at the project root that
  contains the .kanbn directory, not into .kanbn itself.

SETUP

  kanbn-mcp setup asks the board conventions once (columns + meanings, type and
  priority tag vocabulary, tag style, WIP limits, custom fields, relation
  mirroring) and writes them as client-neutral AI guidance into the files each
  AI client reads - one canonical body, thin per-client envelopes:

    AGENTS.md (universal)               .opencode/skills/kanbn/SKILL.md
    CLAUDE.md                           .clinerules/kanbn.md
    .windsurf/rules/kanbn.md            skills/kanbn/SKILL.md (committed)

  Answers and a write-manifest persist to .kanbn/setup.json, so re-runs amend
  and 'kanbn-mcp uninstall' removes everything.

  Flags:
    --yes              non-interactive: all defaults (or amend persisted answers)
    --json <file>      import answers from a JSON file (non-interactive)
    --host=<slugs>     emit for one client only: opencode|claude|windsurf|
                       cline|devin|copilot (comma-separated). opencode/claude/
                       cline/copilot also install the global skill
                       (~/.config/opencode/skills, ~/.claude/skills,
                       ~/.cline/skills, ~/.copilot/skills); copilot emits the
                       universal AGENTS.md it reads from the workspace root
                       plus its workspace skill (.github/skills/kanbn/SKILL.md)
    --repo-only        write repo files only (the default)
    --mcp              also register the kanbn MCP server in detected client
                       configs: opencode.json, ~/.claude.json,
                       cline_mcp_settings.json, ~/.codeium/windsurf/mcp_config.json,
                       VS Code user mcp.json (GitHub Copilot)
    --mcp=<clients>    register only in the listed clients (comma-separated)
    --list             list detected clients and target files; change nothing
    --dry-run          show what would be written; change nothing
    --print            print the canonical guidance + manual install
                       instructions for any client; change nothing
    --check            report what kanbn-mcp setup has installed so far

  Any client kanbn-mcp setup cannot cover can be wired by hand from the
  canonical body - run 'kanbn-mcp setup --print' to see it and where each
  client reads its guidance files.
`;

/**
 * Print the help text to a stream.
 * @param {NodeJS.WriteStream} [stream] The output stream
 * @returns {void}
 */
export function printHelp(stream: NodeJS.WriteStream = process.stdout): void {
    stream.write(HELP_TEXT);
}

/**
 * Run the MCP server over stdio.
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
    resetOperationQueue();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

/**
 * Determine whether the entry script should run as the MCP server.
 * @param {string[]} [argv] The process arguments
 * @returns {boolean} True when the server should run
 */
export function isMainEntry(argv: string[] = process.argv): boolean {
    const script = argv[1];
    if (!script) {
        return false;
    }
    // A literal 'mcp' positional argument (common MCP-host convention) or
    // --run-server marks this as the server entry, regardless of script name.
    if (argv.slice(2).includes("mcp") || argv.includes("--run-server")) {
        return true;
    }
    const base = path.parse(script).name.toLowerCase();
    return base.includes("server") || base === "kanbn-mcp";
}

if (isMainEntry()) {
    const cliArgs = process.argv.slice(2);
    if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
        printHelp();
        process.exit(0);
    }
    if (cliArgs.includes("--version") || cliArgs.includes("-v")) {
        console.log(version);
        process.exit(0);
    }
    const positional = findFirstPositional(cliArgs);
    if (positional === "setup") {
        runSetup(cliArgs)
            .then(() => process.exit(0))
            .catch((err) => {
                console.error(String((err as Error)?.message ?? err));
                process.exit(1);
            });
    } else if (positional === "uninstall") {
        runUninstall(cliArgs)
            .then(() => process.exit(0))
            .catch((err) => {
                console.error(String((err as Error)?.message ?? err));
                process.exit(1);
            });
    } else {
        main().catch((err) => {
            console.error("Fatal error starting kanbn-mcp server:", err);
            process.exit(1);
        });
    }
}