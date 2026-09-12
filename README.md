# kanbn-mcp

A Model Context Protocol (MCP) server for working with Kanbn boards from AI assistants and other MCP clients.

This project wraps the Kanbn task and board APIs so tools like an LLM agent can inspect board state, initialize boards, create, delete, and archive tasks, and move tasks between columns without requiring direct shell access.

## Why this exists

Kanbn is a powerful markdown-based project board system. This project exposes a small, tool-based interface around that functionality so it can be used from MCP-compatible clients and automation.

## Dependencies

This project depends on the Kanbn library from:

- https://github.com/basementuniverse/kanbn

In this repo, that dependency is installed via npm as:

- `@basementuniverse/kanbn`

This project also works well alongside the optional VS Code extension from:

- https://github.com/basementuniverse/vscode-kanbn

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
- `kanbn.d.ts` — type declarations for the Kanbn dependency
- `tests/kanbn-mcp.test.ts` — unit tests covering commands and task field handling

## Installation

```bash
npm install
```

## Build

```bash
npm run build
```

## MCP client configuration

Run `node dist/server.js --help` to print ready-to-paste configuration snippets for opencode, Claude Desktop, and other MCP hosts.

Configure your MCP client to launch the server using a local Node command. The exact path will depend on where you installed the project, but the structure should look like this:

```json
{
  "mcpServers": {
    "kanbn-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/kanbn-mcp/dist/server.js"
      ],
      "env": {
        "KANBN_DEFAULT_PATH": "/absolute/path/to/your/project-or-board-root"
      }
    }
  }
}
```

Use this pattern in any MCP-compatible host such as a local editor or agent runtime. The important parts are:

- `command`: the Node executable used to launch the server
- `args[0]`: the compiled server entry point, typically `dist/server.js`
- `KANBN_DEFAULT_PATH`: (Optional) the project root directory, not the `.kanbn` folder itself

This should be the directory that contains the `.kanbn` subfolder. In other words, point it at the parent project directory, and let Kanbn manage the `.kanbn` directory underneath it.

## Test

```bash
npm test
```

## Available tools

| Tool                     | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `kanbn_status`           | Check the current status of the Kanbn board          |
| `kanbn_init_board`       | Initialize a new Kanbn board                         |
| `kanbn_initialize_board` | Alias for `kanbn_init_board`                         |
| `kanbn_ensure_board`     | Ensure a Kanbn board exists, initializing if absent  |
| `kanbn_create_task`      | Create a new task with metadata                      |
| `kanbn_delete_task`      | Delete a task from the board (supports `force` flag) |
| `kanbn_archive_task`     | Archive a task on the board                          |
| `kanbn_get_task`         | Retrieve details of a specific task                  |
| `kanbn_edit_task`        | Edit an existing task on the board                   |
| `kanbn_move_task`        | Move a task between columns                          |
| `kanbn_rename_task`      | Rename a task (returns the new task id)              |
| `kanbn_delete_board`     | Delete an entire board directory                     |
| `kanbn_unarchive_task`   | Unarchive a task on the board                        |
| `kanbn_restore_task`     | Alias for `kanbn_unarchive_task`                     |
| `kanbn_find_simple_tasks`| Find simple tasks by title (or all on the board)     |
| `kanbn_get_simple_task`  | Resolve exactly one simple task by title             |
| `kanbn_move_simple_task` | Move a simple task to another column                 |
| `kanbn_move_simple_task_to_board` | Move a simple task onto another board        |
| `kanbn_delete_simple_task` | Remove a simple task from the board               |
| `kanbn_promote_simple_task` | Convert a simple task into a real task file      |

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
- custom metadata via `metadata`

## Relationship to the Kanbn ecosystem

This repo is intentionally a thin layer over the Kanbn runtime:

- Kanbn provides the underlying board/task model and file storage
- kanbn-mcp provides an MCP-compatible interface for agents and tools
- the VS Code extension provides a GUI/editor experience for the same ecosystem

Together, they provide a consistent Kanbn workflow across terminal, editor, and AI tooling.

## License

MIT

## Repository links

- Kanbn: https://github.com/basementuniverse/kanbn
- VS Code extension: https://github.com/basementuniverse/vscode-kanbn
