import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Require internal API module and instantiate Kanbn
const { Kanbn } = require("@basementuniverse/kanbn/src/main.js");
const kanbn = new Kanbn();

function resolveProjectPath(inputPath?: string): string {
    let target = inputPath && inputPath.trim().length > 0
        ? inputPath
        : process.env.KANBN_DEFAULT_PATH || process.cwd();

    target = path.resolve(target);

    // If target points to .kanbn or ends with .kanbn, strip it back to root
    if (path.basename(target) === ".kanbn") {
        target = path.dirname(target);
    }

    return target;
}

async function runInDirectory<T>(targetPath: string, fn: () => Promise<T>): Promise<T> {
    const originalCwd = process.cwd();
    try {
        process.chdir(targetPath);
        return await fn();
    } finally {
        process.chdir(originalCwd);
    }
}

const server = new Server(
    {
        name: "kanbn-mcp",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "kanbn_status",
                description: "Get current board status.",
                inputSchema: {
                    type: "object",
                    properties: {
                        path: {
                            type: "string",
                            description: "Directory containing .kanbn (optional)"
                        }
                    }
                }
            },
            {
                name: "kanbn_create_task",
                description: "Create a new task on the Kanbn board.",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Task title" },
                        column: { type: "string", description: "Target column name" },
                        description: { type: "string", description: "Task description" },
                        path: { type: "string", description: "Target project directory path" }
                    },
                    required: ["name", "column"]
                }
            },
            {
                name: "kanbn_move_task",
                description: "Move a task to another column.",
                inputSchema: {
                    type: "object",
                    properties: {
                        taskId: { type: "string", description: "Task ID or filename" },
                        column: { type: "string", description: "Destination column name" },
                        path: { type: "string", description: "Target project directory path" }
                    },
                    required: ["taskId", "column"]
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const rawPath = args?.path as string | undefined;
    const targetDir = resolveProjectPath(rawPath);

    try {
        return await runInDirectory(targetDir, async () => {
            switch (name) {
                case "kanbn_status": {
                    const index = await kanbn.getIndex();
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(index, null, 2)
                            }
                        ]
                    };
                }

                case "kanbn_create_task": {
                    const { name: taskName, column, description } = args as {
                        name: string;
                        column: string;
                        description?: string;
                    };
                    const taskId = await kanbn.createTask(
                        { name: taskName, description: description || "" },
                        column
                    );
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Created task "${taskName}" (${taskId}) in column "${column}".`
                            }
                        ]
                    };
                }

                case "kanbn_move_task": {
                    const { taskId, column } = args as { taskId: string; column: string };
                    await kanbn.moveTask(taskId, column);
                    return {
                        content: [
                            {
                                type: "text",
                                text: `Moved task "${taskId}" to column "${column}".`
                            }
                        ]
                    };
                }

                default:
                    throw new Error(`Unknown tool: ${name}`);
            }
        });
    } catch (error: any) {
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Kanbn error operating in [${targetDir}]: ${error?.message || String(error)}`
                }
            ]
        };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});