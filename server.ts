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

export function resolveProjectPath(inputPath?: string): string {
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

async function ensureBoardExists(kanbn: any, targetDir: string): Promise<void> {
    try {
        if (typeof kanbn.initialised === "function") {
            const isInit = await kanbn.initialised();
            if (!isInit) {
                throw new Error(`No Kanbn board found in directory [${targetDir}].`);
            }
        }

        if (typeof kanbn.getIndex !== "function") {
            throw new TypeError(`No Kanbn board found in directory [${targetDir}].`);
        }
    } catch (err: any) {
        const message = String(err?.message || "");
        if (
            err?.code === "ENOENT" ||
            /not initialized|not initialised|No Kanbn board found/i.test(message)
        ) {
            throw new Error(`No Kanbn board found in directory [${targetDir}].`);
        }
        throw err;
    }
}

export const toolDefinitions = [
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
        name: "kanbn_init_board",
        description: "Initialize a Kanbn board in the target directory.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory to initialize" },
                name: { type: "string", description: "Board name" },
                description: { type: "string", description: "Board description" },
                columns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Initial column names"
                }
            }
        }
    },
    {
        name: "kanbn_initialize_board",
        description: "Alias for kanbn_init_board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory to initialize" },
                name: { type: "string", description: "Board name" },
                description: { type: "string", description: "Board description" },
                columns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Initial column names"
                }
            }
        }
    },
    {
        name: "kanbn_ensure_board",
        description: "Ensure a Kanbn board exists in the target directory; initialize it if missing.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Directory to check or initialize" },
                name: { type: "string", description: "Board name" },
                description: { type: "string", description: "Board description" },
                columns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Initial column names"
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
                started: { type: "string", description: "Start date/time" },
                completed: { type: "string", description: "Completion date/time" },
                progress: { type: "number", description: "Completion progress between 0 and 1" },
                plannedStart: { type: "string", description: "Planned start date/time" },
                plannedFinish: { type: "string", description: "Planned finish date/time" },
                created: { type: "string", description: "Creation date/time" },
                updated: { type: "string", description: "Last updated date/time" },
                tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of tags"
                },
                subTasks: {
                    type: "array",
                    description: "List of sub-tasks in the form [{ text, completed }]",
                    items: {
                        type: "object",
                        properties: {
                            text: { type: "string" },
                            completed: { type: "boolean" }
                        },
                        required: ["text"]
                    }
                },
                comments: {
                    type: "array",
                    description: "List of comments in the form [{ author, date, text }]",
                    items: {
                        type: "object",
                        properties: {
                            author: { type: "string" },
                            date: { type: "string" },
                            text: { type: "string" }
                        },
                        required: ["text"]
                    }
                },
                metadata: {
                    type: "object",
                    description: "Additional Kanbn metadata fields to set as top-level task properties",
                    additionalProperties: true
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
];

function coerceDate(value: any): any {
    if (value === undefined || value === null || value === "") {
        return value;
    }

    if (value instanceof Date) {
        return value;
    }

    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed;
    }

    return value;
}

export function buildTaskDataFromArgs(args: Record<string, any> | undefined): Record<string, any> {
    const payload = args ?? {};
    const {
        name, // renamed from taskName for simplicity in destructuring
        description = "",
        assigned,
        due,
        started,
        completed,
        progress,
        plannedStart,
        plannedFinish,
        created,
        updated,
        tags,
        metadata,
        subTasks,
        comments,
    } = payload;

    const taskData: Record<string, any> = {
        name: name,
        description: description,
        metadata: {}
    };

    if (metadata && typeof metadata === "object") {
        Object.assign(taskData.metadata, metadata);
    }

    if (assigned) taskData.metadata.assigned = assigned;
    if (due) taskData.metadata.due = coerceDate(due);
    if (started) taskData.metadata.started = coerceDate(started);
    if (completed) taskData.metadata.completed = coerceDate(completed);
    if (typeof progress === "number") taskData.metadata.progress = progress;
    if (plannedStart) taskData.metadata.plannedStart = coerceDate(plannedStart);
    if (plannedFinish) taskData.metadata.plannedFinish = coerceDate(plannedFinish);
    if (created) taskData.metadata.created = coerceDate(created);
    if (updated) taskData.metadata.updated = coerceDate(updated);
    if (tags && Array.isArray(tags)) taskData.metadata.tags = tags;

    if (Array.isArray(subTasks)) {
        taskData.subTasks = subTasks.map((subTask: any) => {
            if (subTask && typeof subTask === "object") {
                return {
                    text: String(subTask.text ?? ""),
                    completed: Boolean(subTask.completed),
                };
            }

            return { text: String(subTask), completed: false };
        });
    }

    if (Array.isArray(comments)) {
        taskData.comments = comments.map((comment: any) => {
            if (comment && typeof comment === "object") {
                return {
                    author: String(comment.author ?? ""),
                    date: coerceDate(comment.date),
                    text: String(comment.text ?? ""),
                };
            }

            return { text: String(comment), author: "", date: new Date() };
        });
    }

    return taskData;
}

/**
 * Single source of truth for tool execution logic.
 */
export async function handleToolCall(name: string, args: Record<string, any> | undefined) {
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

            case "kanbn_init_board":
            case "kanbn_initialize_board":
            case "kanbn_ensure_board": {
                const isEnsure = name === "kanbn_ensure_board";
                const { name: boardName, description, columns } = args || {};

                if (typeof kanbn.initialised === "function") {
                    const isInit = await kanbn.initialised();
                    if (isInit) {
                        return {
                            content: [{ type: "text", text: `Kanbn board ${isEnsure ? 'already exists' : 'already initialized'} in [${targetDir}].` }]
                        };
                    }
                }

                if (typeof kanbn.initialise !== "function") {
                    throw new TypeError("This Kanbn version does not support board initialization.");
                }

                const options: Record<string, any> = {};
                if (boardName) options.name = boardName;
                if (description) options.description = description;
                if (columns?.length > 0) options.columns = columns;

                await kanbn.initialise(options);

                return {
                    content: [{
                        type: "text",
                        text: `${isEnsure ? 'Ensured Kanbn board exists' : 'Initialized Kanbn board'} in [${targetDir}]${boardName ? ` with name "${boardName}"` : ""}.`
                    }]
                };
            }

            case "kanbn_create_task": {
                await ensureBoardExists(kanbn, targetDir);
                const taskId = await kanbn.createTask(buildTaskDataFromArgs(args), args?.column as string);

                return {
                    content: [{
                        type: "text",
                        text: `Created task "${args?.name}" (${taskId}) in column "${args?.column}".`
                    }]
                };
            }

            case "kanbn_move_task": {
                await ensureBoardExists(kanbn, targetDir);
                const { taskId, column } = args || {};
                await kanbn.moveTask(taskId, column);
                return {
                    content: [{ type: "text", text: `Moved task "${taskId}" to column "${column}".` }]
                };
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return {
            isError: true,
            content: [{ type: "text", text: `Kanbn error in [${targetDir}]: ${error?.message || String(error)}` }]
        };
    }
}
export async function listTools() {
    return { tools: toolDefinitions };
}

const server = new Server({ name: "kanbn-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

// REFACTORED HANDLERS
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: toolDefinitions }; // Use the array!
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    // Simply delegate to the single source of truth
    return await handleToolCall(name, args);
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

if (require.main === module) {
    main().catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
}