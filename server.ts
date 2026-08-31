import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// The package root export is the CLI wrapper function, not the Kanbn instance class.
// Import the actual implementation module directly so we can instantiate the real API.
const KanbnModule = require("@basementuniverse/kanbn");
const KanbnClass = require("@basementuniverse/kanbn/src/main.js")?.Kanbn;

function resolveProjectPath(inputPath?: string): string {
    let target = inputPath && inputPath.trim().length > 0
        ? inputPath
        : process.env.KANBN_DEFAULT_PATH || process.cwd();

    target = path.resolve(target);

    // If target points directly to .kanbn, move back up to the project root
    if (path.basename(target) === ".kanbn") {
        target = path.dirname(target);
    }

    return target;
}

/**
 * Safely obtain a Kanbn instance bound to the target directory.
 *
 * The package root export is the CLI wrapper function, not the Kanbn class itself,
 * so we must prefer the constructor that actually exposes getIndex()/initialised().
 */
function isKanbnLike(value: any): boolean {
    return !!value && typeof value === "object" && (
        typeof value.getIndex === "function" ||
        typeof value.initialised === "function" ||
        typeof value.status === "function"
    );
}

function isKanbnConstructor(value: any): boolean {
    if (typeof value !== "function") return false;
    return !!value.prototype && (
        typeof value.prototype.getIndex === "function" ||
        typeof value.prototype.initialised === "function" ||
        typeof value.prototype.status === "function"
    );
}

function getKanbnInstance(targetDir: string) {
    if (typeof KanbnClass === "function") {
        try {
            const instance = new KanbnClass(targetDir);
            if (isKanbnLike(instance)) {
                return instance;
            }
        } catch {
            // fall through to the legacy fallback below
        }
    }

    const candidates = [
        KanbnModule,
        KanbnModule?.Kanbn,
        KanbnModule?.default,
        KanbnModule?.default?.Kanbn,
        KanbnModule?.default?.default,
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;

        if (isKanbnLike(candidate)) {
            return candidate;
        }

        if (isKanbnConstructor(candidate)) {
            const instance = new candidate(targetDir);
            if (isKanbnLike(instance)) {
                return instance;
            }
        }

        if (typeof candidate === "function") {
            try {
                const instance = candidate(targetDir);
                if (isKanbnLike(instance)) {
                    return instance;
                }
            } catch {
                // ignore constructor-style failures and continue to another candidate
            }
        }
    }

    throw new Error(
        "Unable to create a Kanbn client: the package export does not expose a usable Kanbn instance."
    );
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
                description: "Create a new task on the Kanbn board with optional metadata.",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Task title" },
                        column: { type: "string", description: "Target column name" },
                        description: { type: "string", description: "Task body description" },
                        assigned: { type: "string", description: "Username or name of assignee" },
                        due: { type: "string", description: "Due date/deadline (e.g. YYYY-MM-DD or ISO string)" },
                        tags: {
                            type: "array",
                            items: { type: "string" },
                            description: "List of tags"
                        },
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
        const kanbn = getKanbnInstance(targetDir);

        switch (name) {
            case "kanbn_status": {
                try {
                    if (typeof kanbn.initialised === "function") {
                        const isInit = await kanbn.initialised();
                        if (!isInit) {
                            return {
                                content: [
                                    {
                                        type: "text",
                                        text: `No Kanbn board found in directory [${targetDir}]. You can initialize one first.`
                                    }
                                ]
                            };
                        }
                    }

                    if (typeof kanbn.getIndex !== "function") {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `No Kanbn board found in directory [${targetDir}].`
                                }
                            ]
                        };
                    }

                    const index = await kanbn.getIndex();
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify(index, null, 2)
                            }
                        ]
                    };
                } catch (err: any) {
                    const message = String(err?.message || "");
                    if (
                        err?.code === "ENOENT" ||
                        /not initialized|not initialised|No Kanbn board found/i.test(message)
                    ) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `No Kanbn board found in directory [${targetDir}].`
                                }
                            ]
                        };
                    }
                    throw err;
                }
            }

            case "kanbn_create_task": {
                const {
                    name: taskName,
                    column,
                    description,
                    assigned,
                    due,
                    tags
                } = args as {
                    name: string;
                    column: string;
                    description?: string;
                    assigned?: string;
                    due?: string;
                    tags?: string[];
                };

                const taskData: Record<string, any> = {
                    name: taskName,
                    description: description || ""
                };

                if (assigned) taskData.assigned = assigned;
                if (due) taskData.due = due;
                if (tags && Array.isArray(tags)) taskData.tags = tags;

                const taskId = await kanbn.createTask(taskData, column);

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