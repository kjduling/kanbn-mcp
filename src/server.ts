import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";

function getKanbnInstance(boardPath: string): any {
    let mod: any;
    try {
        mod = require("@basementuniverse/kanbn/src/main.js");
    } catch {
        try {
            mod = require("@basementuniverse/kanbn");
        } catch {
            return null;
        }
    }

    const Kanbn = mod?.Kanbn || mod?.default?.Kanbn || (typeof mod === "function" ? mod : mod?.default);
    if (typeof Kanbn === "function") {
        return new Kanbn(boardPath);
    }
    if (mod && typeof mod === "object") {
        return mod;
    }
    return null;
}

export const server = new Server(
    {
        name: "kanbn-mcp",
        version: "0.1.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

let operationQueue: Promise<void> = Promise.resolve();

export function enqueueKanbnOperation<T>(op: () => Promise<T>): Promise<T> {
    const result = operationQueue.then(op);
    operationQueue = result.then(
        () => { },
        () => { }
    );
    return result;
}

export function getKanbnPath(customPath?: string): string {
    if (customPath) {
        return path.resolve(customPath);
    }
    if (process.env.KANBN_DEFAULT_PATH) {
        return path.resolve(process.env.KANBN_DEFAULT_PATH);
    }
    return process.cwd();
}

/**
 * Helper to convert valid date strings to JS Date objects for Kanbn's schema validator
 */
function convertDatesInObject(obj: Record<string, any>): Record<string, any> {
    const dateKeys = new Set([
        "due",
        "created",
        "updated",
        "started",
        "completed",
        "plannedStart",
        "plannedFinish",
    ]);

    for (const key of Object.keys(obj)) {
        if (dateKeys.has(key) && typeof obj[key] === "string") {
            const parsed = new Date(obj[key]);
            if (!Number.isNaN(parsed.getTime())) {
                obj[key] = parsed;
            }
        }
    }
    return obj;
}

export function buildTaskDataFromArgs(args: Record<string, any>): Record<string, any> {
    if (!args || typeof args !== "object") {
        return {};
    }

    let source = { ...args };
    if (source.taskData) {
        let nested = source.taskData;
        if (typeof nested === "string") {
            try {
                nested = JSON.parse(nested);
            } catch { }
        }
        if (nested && typeof nested === "object") {
            delete source.taskData;
            source = { ...source, ...nested };
        }
    }

    const taskData: Record<string, any> = {};
    const metadata: Record<string, any> = {};

    const topLevelKeys = new Set([
        "name",
        "title",
        "description",
        "subTasks",
        "comments",
        "relations",
    ]);

    const ignoreKeys = new Set(["path", "column", "targetColumn", "taskId"]);

    if (source.metadata && typeof source.metadata === "object") {
        Object.assign(metadata, source.metadata);
    }

    for (const [key, value] of Object.entries(source)) {
        if (value === undefined || ignoreKeys.has(key) || key === "metadata") {
            continue;
        }

        if (topLevelKeys.has(key)) {
            taskData[key] = value;
        } else {
            metadata[key] = value;
        }
    }

    if (taskData.title && !taskData.name) {
        taskData.name = taskData.title;
    }

    // Convert date fields in metadata
    convertDatesInObject(metadata);

    if (Object.keys(metadata).length > 0) {
        taskData.metadata = metadata;
    }

    if (Array.isArray(taskData.comments)) {
        taskData.comments = taskData.comments.map((comment: any) => {
            if (comment && typeof comment.date === "string") {
                return { ...comment, date: new Date(comment.date) };
            }
            return comment;
        });
    }

    if (Array.isArray(taskData.subTasks)) {
        taskData.subTasks = taskData.subTasks.map((sub: any) => {
            if (typeof sub === "string") {
                return { text: sub, completed: false };
            }
            return {
                text: String(sub?.text ?? sub?.name ?? sub?.description ?? ""),
                completed: Boolean(sub?.completed),
            };
        });
    }

    return taskData;
}

async function isBoardInitialized(instance: any, boardPath: string): Promise<boolean> {
    if (!instance) return false;
    const fn = instance.initialised || instance.initialized || instance.isInitialized || instance.isInitialised;
    if (typeof fn === "function") {
        try {
            return await fn.call(instance);
        } catch {
            try {
                return await fn.call(instance, boardPath);
            } catch { }
        }
    }
    return false;
}

export async function handleKanbnStatus(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    const initialized = await isBoardInitialized(instance, boardPath);
    if (!initialized) {
        return {
            content: [{ type: "text", text: `No Kanbn board found at: ${boardPath}` }],
        };
    }
    const getIndexFn = instance.getIndex || instance.index || instance.loadIndex;
    const index = typeof getIndexFn === "function" ? await getIndexFn.call(instance) : {};
    return {
        content: [{ type: "text", text: JSON.stringify(index, null, 2) }],
    };
}

export async function handleKanbnInitBoard(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const boardName = (args.name as string) || "Project Board";
    const columns = Array.isArray(args.columns) ? args.columns : undefined;

    const initFn = instance.initialise || instance.init || instance.initialize || instance.initBoard;
    if (typeof initFn !== "function") {
        throw new TypeError(`No initialization method found on Kanbn instance`);
    }

    try {
        await initFn.call(instance, boardName, columns);
    } catch {
        await initFn.call(instance, { name: boardName, columns });
    }

    return {
        content: [{ type: "text", text: `Successfully initialized Kanbn board at: ${boardPath}` }],
    };
}

export async function handleKanbnEnsureBoard(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    const initialized = await isBoardInitialized(instance, boardPath);
    if (!initialized) {
        await handleKanbnInitBoard(args);
    }
    return {
        content: [{ type: "text", text: `Ensured Kanbn board exists at: ${boardPath}` }],
    };
}

export async function handleKanbnCreateTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const taskData = buildTaskDataFromArgs(args);
    let column = args.column || args.col || taskData.column || taskData.metadata?.column;

    if (taskData.metadata) {
        delete taskData.metadata.column;
    }
    delete taskData.column;

    if (!column) {
        try {
            const getIndexFn = instance.getIndex || instance.index || instance.loadIndex;
            if (typeof getIndexFn === "function") {
                const index = await getIndexFn.call(instance);
                const cols = index?.columns ? (Array.isArray(index.columns) ? index.columns : Object.keys(index.columns)) : [];
                if (cols.length > 0) {
                    column = typeof cols[0] === "string" ? cols[0] : (cols[0].name || cols[0].id);
                }
            }
        } catch { }
    }

    const createFn = instance.createTask || instance.create || instance.addTask;
    if (typeof createFn !== "function") {
        throw new TypeError(`No createTask method found on Kanbn instance`);
    }

    let createdTaskId: any;
    if (column) {
        createdTaskId = await createFn.call(instance, taskData, column);
    } else {
        createdTaskId = await createFn.call(instance, taskData);
    }

    const taskIdStr = typeof createdTaskId === "string"
        ? createdTaskId
        : (createdTaskId?.id || createdTaskId?.name || String(createdTaskId));

    const taskName = taskData.name || taskData.title || taskIdStr;

    return {
        content: [
            {
                type: "text",
                text: `Created task "${taskName}" (${taskIdStr})`,
            },
        ],
    };
}

export async function handleKanbnDeleteTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const taskId = args.taskId as string;
    if (!taskId) {
        throw new Error(`Missing required parameter: taskId`);
    }

    const force = Boolean(args.force);

    const deleteFn = instance.deleteTask || instance.removeTask || instance.delete;
    if (typeof deleteFn !== "function") {
        throw new TypeError(`No deleteTask method found on Kanbn instance`);
    }

    await deleteFn.call(instance, taskId, force);

    return {
        content: [
            {
                type: "text",
                text: `Deleted task "${taskId}"${force ? " (forced)" : ""}`,
            },
        ],
    };
}

export async function handleKanbnArchiveTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const taskId = args.taskId as string;
    if (!taskId) {
        throw new Error(`Missing required parameter: taskId`);
    }

    const archiveFn = instance.archiveTask || instance.archive || instance.prchive;
    if (typeof archiveFn !== "function") {
        throw new TypeError(`No archiveTask method found on Kanbn instance`);
    }

    await archiveFn.call(instance, taskId);

    return {
        content: [
            {
                type: "text",
                text: `Archived task "${taskId}"`,
            },
        ],
    };
}

export async function handleKanbnUnarchiveTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const taskId = args.taskId as string;
    if (!taskId) {
        throw new Error(`Missing required parameter: taskId`);
    }

    const restoreFn = instance.restoreTask || instance.restore || instance.unarchiveTask;
    if (typeof restoreFn !== "function") {
        throw new TypeError(`No restoreTask method found on Kanbn instance`);
    }

    await restoreFn.call(instance, taskId);

    return {
        content: [
            {
                type: "text",
                text: `Unarchived task "${taskId}"`,
            },
        ],
    };
}

export async function handleKanbnGetTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const taskId = args.taskId as string;
    if (!taskId) {
        throw new Error(`Missing required parameter: taskId`);
    }

    const getFn = instance.getTask || instance.get || instance.fetchTask;
    if (typeof getFn !== "function") {
        throw new TypeError(`No getTask method found on Kanbn instance`);
    }

    const task = await getFn.call(instance, taskId);

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(task, null, 2),
            },
        ],
    };
}

export async function handleKanbnEditTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const taskId = args.taskId as string;
    if (!taskId) {
        throw new Error(`Missing required parameter: taskId`);
    }

    const taskData = buildTaskDataFromArgs(args);
    if (Object.keys(taskData).length === 0) {
        throw new Error(`No fields provided to edit`);
    }

    const getFn = instance.getTask || instance.get || instance.fetchTask;
    if (typeof getFn === "function") {
        try {
            const existingTask = await getFn.call(instance, taskId);
            if (existingTask && typeof existingTask === "object") {
                if (!taskData.name && existingTask.name) {
                    taskData.name = existingTask.name;
                }
                if (!taskData.description && existingTask.description) {
                    taskData.description = existingTask.description;
                }
                if (!taskData.metadata) {
                    taskData.metadata = {};
                }
                const existingMeta = existingTask.metadata || {};
                for (const key of Object.keys(existingMeta)) {
                    if (taskData.metadata[key] === undefined) {
                        taskData.metadata[key] = existingMeta[key];
                    }
                }
            }
        } catch {
            // Task may not exist yet; proceed with provided fields
        }
    }

    if (taskData.name) {
        const getIndexFn = instance.getIndex || instance.index || instance.loadIndex;
        if (typeof getIndexFn === "function") {
            try {
                const index = await getIndexFn.call(instance);
                const cols = index?.columns || index;
                if (typeof cols === "object" && !Array.isArray(cols)) {
                    for (const colTasks of Object.values(cols)) {
                        const taskIds = Array.isArray(colTasks) ? colTasks : (colTasks?.tasks || []);
                        if (Array.isArray(taskIds)) {
                            for (const id of taskIds) {
                                if (typeof id === "string" && id.toLowerCase() === taskData.name.toLowerCase().replace(/\s+/g, "-")) {
                                    if (id !== taskId) {
                                        throw new Error(`Cannot rename task: a task with name "${taskData.name}" already exists`);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (err: any) {
                if (err.message && err.message.startsWith("Cannot rename task:")) {
                    throw err;
                }
                // Index error is non-fatal; let editTask handle it
            }
        }
    }

    const editFn = instance.editTask || instance.updateTask || instance.edit || instance.update;
    if (typeof editFn !== "function") {
        throw new TypeError(`No editTask method found on Kanbn instance`);
    }

    await editFn.call(instance, taskId, taskData);

    return {
        content: [
            {
                type: "text",
                text: `Edited task "${taskId}"`,
            },
        ],
    };
}

export async function handleKanbnDeleteBoard(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const fs = await import("node:fs");
    if (!fs.existsSync(boardPath)) {
        return {
            content: [{ type: "text", text: `Board directory does not exist: ${boardPath}` }],
        };
    }

    fs.rmSync(boardPath, { recursive: true, force: true });

    return {
        content: [{ type: "text", text: `Deleted board at: ${boardPath}` }],
    };
}

export async function handleKanbnMoveTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const taskId = args.taskId as string;
    const targetColumn = args.targetColumn || args.column || args.col;

    const moveFn = instance.moveTask || instance.move;
    if (typeof moveFn !== "function") {
        throw new TypeError(`No moveTask method found on Kanbn instance`);
    }

    await moveFn.call(instance, taskId, targetColumn);

    return {
        content: [
            {
                type: "text",
                text: `Moved task ${taskId} to column "${targetColumn}"`,
            },
        ],
    };
}

export const TOOLS: Tool[] = [
    {
        name: "kanbn_status",
        description: "Check the current status of the Kanbn board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
            },
        },
    },
    {
        name: "kanbn_init_board",
        description: "Initialize a new Kanbn board in the target directory.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                name: { type: "string", description: "Name of the board" },
                columns: { type: "array", items: { type: "string" }, description: "Initial board columns" },
            },
        },
    },
    {
        name: "kanbn_initialize_board",
        description: "Alias for kanbn_init_board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                name: { type: "string", description: "Name of the board" },
                columns: { type: "array", items: { type: "string" }, description: "Initial board columns" },
            },
        },
    },
    {
        name: "kanbn_ensure_board",
        description: "Ensure a Kanbn board exists, initializing one if absent.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                name: { type: "string", description: "Name of the board" },
            },
        },
    },
    {
        name: "kanbn_create_task",
        description: "Create a new task on the Kanbn board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskData: { type: "object", description: "Kanbn task metadata object" },
                column: { type: "string", description: "Target column for the new task" },
                name: { type: "string", description: "Task title" },
                description: { type: "string", description: "Task detailed description" },
                assigned: { type: "string", description: "Assignee" },
                subTasks: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            text: { type: "string", description: "Sub-task text" },
                            name: { type: "string", description: "Alias for text" },
                            description: { type: "string", description: "Alias for text" },
                            completed: { type: "boolean", description: "Whether the sub-task is completed" },
                        },
                    },
                },
                comments: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            author: { type: "string", description: "Comment author" },
                            date: { type: "string", description: "Comment date (ISO string)" },
                            text: { type: "string", description: "Comment text" },
                        },
                    },
                },
            },
        },
    },
    {
        name: "kanbn_move_task",
        description: "Move an existing task to a different column.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskId: { type: "string", description: "ID or filename of the task" },
                targetColumn: { type: "string", description: "Column to move the task into" },
            },
            required: ["taskId", "targetColumn"],
        },
    },
    {
        name: "kanbn_delete_task",
        description: "Delete a task from the Kanbn board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskId: { type: "string", description: "ID or filename of the task to delete" },
                force: { type: "boolean", description: "Force deletion without confirmation" },
            },
            required: ["taskId"],
        },
    },
    {
        name: "kanbn_archive_task",
        description: "Archive a task on the Kanbn board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskId: { type: "string", description: "ID or filename of the task to archive" },
            },
            required: ["taskId"],
        },
    },
    {
        name: "kanbn_get_task",
        description: "Retrieve details of a specific task from the Kanbn board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskId: { type: "string", description: "ID or filename of the task to retrieve" },
            },
            required: ["taskId"],
        },
    },
    {
        name: "kanbn_edit_task",
        description: "Edit an existing task on the Kanbn board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskId: { type: "string", description: "ID or filename of the task to edit" },
                name: { type: "string", description: "Task title" },
                description: { type: "string", description: "Task detailed description" },
                assigned: { type: "string", description: "Assignee" },
                due: { type: "string", description: "Due date (ISO string)" },
                started: { type: "string", description: "Start date (ISO string)" },
                completed: { type: "string", description: "Completion date (ISO string)" },
                progress: { type: "number", description: "Progress (0-1)" },
                plannedStart: { type: "string", description: "Planned start date (ISO string)" },
                plannedFinish: { type: "string", description: "Planned finish date (ISO string)" },
                tags: { type: "array", items: { type: "string" }, description: "Tags array" },
                subTasks: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            text: { type: "string", description: "Sub-task text" },
                            name: { type: "string", description: "Alias for text" },
                            description: { type: "string", description: "Alias for text" },
                            completed: { type: "boolean", description: "Whether the sub-task is completed" },
                        },
                    },
                },
                comments: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            author: { type: "string", description: "Comment author" },
                            date: { type: "string", description: "Comment date (ISO string)" },
                            text: { type: "string", description: "Comment text" },
                        },
                    },
                },
            },
            required: ["taskId"],
        },
    },
    {
        name: "kanbn_delete_board",
        description: "Delete an entire Kanbn board directory.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the board directory to delete" },
            },
        },
    },
    {
        name: "kanbn_unarchive_task",
        description: "Unarchive a task on the Kanbn board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskId: { type: "string", description: "ID or filename of the task to unarchive" },
            },
            required: ["taskId"],
        },
    },
    {
        name: "kanbn_restore_task",
        description: "Alias for kanbn_unarchive_task.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskId: { type: "string", description: "ID or filename of the task to unarchive" },
            },
            required: ["taskId"],
        },
    },
];

export function listTools() {
    return { tools: TOOLS };
}

export async function handleToolCall(name: string, args: Record<string, any> = {}) {
    return enqueueKanbnOperation(async () => {
        switch (name) {
            case "kanbn_status":
                return handleKanbnStatus(args);
            case "kanbn_init_board":
            case "kanbn_initialize_board":
                return handleKanbnInitBoard(args);
            case "kanbn_ensure_board":
                return handleKanbnEnsureBoard(args);
            case "kanbn_create_task":
                return handleKanbnCreateTask(args);
            case "kanbn_move_task":
                return handleKanbnMoveTask(args);
            case "kanbn_delete_task":
                return handleKanbnDeleteTask(args);
            case "kanbn_archive_task":
                return handleKanbnArchiveTask(args);
            case "kanbn_get_task":
                return handleKanbnGetTask(args);
            case "kanbn_edit_task":
                return handleKanbnEditTask(args);
            case "kanbn_delete_board":
                return handleKanbnDeleteBoard(args);
            case "kanbn_unarchive_task":
            case "kanbn_restore_task":
                return handleKanbnUnarchiveTask(args);
            default:
                throw new Error(`Unknown tool requested: ${name}`);
        }
    });
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return listTools();
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    return handleToolCall(name, args);
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

if (process.argv[1]?.endsWith("server.js")) {
    main().catch((err) => {
        console.error("Fatal error starting kanbn-mcp server:", err);
        process.exit(1);
    });
}