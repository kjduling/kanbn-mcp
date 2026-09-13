import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";

/**
 * Create a Kanbn board instance for a directory.
 * @param {string} boardPath Path to the project root directory (must contain a .kanbn folder)
 * @returns {any} A Kanbn instance, or undefined if boards are not supported
 */
export function getKanbnInstance(boardPath: string): any {
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
    return null;
}

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

/**
 * sessionQueue serializes operations within a single session.
 * Limitation: this server uses a single StdioServerTransport — no concurrent connections.
 * If multiple connections ever arise, a per-connection queue would be required.
 */

let sessionQueue: Promise<void> = Promise.resolve();

/**
 * Reset the shared operation queue state.
 * @returns {void}
 */
export function resetOperationQueue(): void {
    sessionQueue = Promise.resolve();
}

/**
 * Serialize a board operation through the shared session queue.
 * @template T The operation result type
 * @param {() => Promise<T>} op Async operation to run
 * @returns {Promise<T>} A promise resolving to the operation result
 */
export function enqueueKanbnOperation<T>(op: () => Promise<T>): Promise<T> {
    const result = sessionQueue.then(op);
    // Tail must swallow the rejection: if it were `result` itself, a failure
    // would poison every later op with a stale error. Caller still gets the
    // rejection via `result`, so the queue resets to a known-good state.
    sessionQueue = result.then(
        () => { },
        (error: unknown) => {
            console.error("[kanbn-mcp] queued operation failed; queue resumed:", error);
        }
    );
    return result;
}

/**
 * Resolve the board path from an explicit override, the KANBN_DEFAULT_PATH
 * environment variable, or the server working directory.
 * @param {string} [customPath] Optional explicit board path
 * @returns {string} The resolved absolute board path
 */
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
 * Recursively convert ISO date strings in a task metadata object into Date values.
 * @param {Record<string, any>} obj Object to convert
 * @returns {Record<string, any>} A new object with dates converted
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

/**
 * Build a Kanbn task metadata object from MCP tool arguments.
 * @param {Record<string, any>} args Raw MCP tool arguments
 * @returns {Record<string, any>} A normalized Kanbn task metadata object
 */
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
        Object.assign(metadata, structuredClone(source.metadata));
    }

    for (const [key, value] of Object.entries(source)) {
        if (value === undefined || ignoreKeys.has(key) || key === "metadata") {
            continue;
        }

        if (topLevelKeys.has(key)) {
            taskData[key] = value && typeof value === "object" ? structuredClone(value) : value;
        } else {
            metadata[key] = value && typeof value === "object" ? structuredClone(value) : value;
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
            // text is the primary field; name and description are deprecated aliases kept for
            // backwards compatibility. Precedence: text ?? name ?? description.
            return {
                text: String(sub?.text ?? sub?.name ?? sub?.description ?? ""),
                completed: Boolean(sub?.completed),
            };
        });
    }

    return taskData;
}

/**
 * Check whether the board at boardPath is already initialized.
 * @param {any} instance A Kanbn instance
 * @param {string} boardPath Path to the project root directory
 * @returns {Promise<boolean>} True when the board is initialized
 */
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

/**
 * Handle the "kanbn_status" MCP tool call: return a board status summary.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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

/**
 * Handle the "kanbn_init_board" / "kanbn_initialize_board" MCP tool call: initialize a new board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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

    let lastError: Error | null = null;

    try {
        await initFn.call(instance, { name: boardName, columns });
    } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        try {
            await initFn.call(instance, boardName, columns);
        } catch (e2) {
            lastError = e2 instanceof Error ? e2 : new Error(String(e2));
        }
    }

    if (lastError) {
        throw new Error(`Kanbn init failed on both attempts: ${lastError.message}`);
    }

    return {
        content: [{ type: "text", text: `Successfully initialized Kanbn board at: ${boardPath}` }],
    };
}

/**
 * Handle the "kanbn_ensure_board" MCP tool call: initialize a board if one is absent.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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

/**
 * Handle the "kanbn_create_task" MCP tool call: create a task, falling back to an explicit column.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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

/**
 * Handle the "kanbn_delete_task" MCP tool call: delete a task (or act on an already-archived one).
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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

/**
 * Resolve the archive method (archive or delete) available on a Kanbn instance.
 * @param {any} instance A Kanbn instance
 * @returns {((taskId: string) => unknown) | undefined} The archive method, if present
 */
export function getArchiveMethod(instance: any): ((taskId: string) => unknown) | undefined {
    return instance?.archiveTask ?? instance?.archive;
}

/**
 * Handle the "kanbn_archive_task" MCP tool call: archive a task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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

    const archiveFn = getArchiveMethod(instance);
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

/**
 * Handle the "kanbn_unarchive_task" / "kanbn_restore_task" MCP tool call: unarchive a task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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

/**
 * Handle the "kanbn_get_task" MCP tool call: retrieve a task by id.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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

/**
 * Handle the "kanbn_edit_task" MCP tool call: edit fields on an existing task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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
                        const taskIds = Array.isArray(colTasks) ? colTasks : (colTasks as any)?.tasks || [];
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

/**
 * Handle the "kanbn_delete_board" MCP tool call: delete an entire board directory.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnDeleteBoard(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const fs = await import("node:fs");

    if (!boardPath || boardPath === "/") {
        return {
            content: [{ type: "text", text: "Cannot delete root directory." }],
        };
    }

    const kanbnDir = path.join(boardPath, ".kanbn");
    if (!fs.existsSync(kanbnDir)) {
        return {
            content: [{ type: "text", text: `Not a Kanbn board directory: ${boardPath} (no .kanbn folder found)` }],
        };
    }

    fs.rmSync(boardPath, { recursive: true, force: true });

    return {
        content: [{ type: "text", text: `Deleted board at: ${boardPath}` }],
    };
}

/**
 * Handle the "kanbn_move_task" MCP tool call: move a task between columns.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
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

/**
 * Handle the "kanbn_rename_task" MCP tool call: rename a task, optionally moving it.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnRenameTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const taskId = args.taskId as string;
    if (!taskId) {
        throw new Error(`Missing required parameter: taskId`);
    }

    const newName = args.newName as string;
    if (typeof newName !== "string" || newName.trim().length === 0) {
        throw new Error(`Missing required parameter: newName`);
    }

    const renameFn = instance.renameTask || instance.rename;
    if (typeof renameFn !== "function") {
        throw new TypeError(`No renameTask method found on Kanbn instance`);
    }

    const newTaskId = await renameFn.call(instance, taskId, newName);

    const targetColumn = args.column as string | undefined;
    if (targetColumn) {
        const moveFn = instance.moveTask || instance.move;
        if (typeof moveFn !== "function") {
            throw new TypeError(`No moveTask method found on Kanbn instance`);
        }
        await moveFn.call(instance, newTaskId, targetColumn, args.position ?? null);
    }

    return {
        content: [
            {
                type: "text",
                text: `Renamed task ${taskId} to "${newName}" (new id: ${newTaskId})`,
            },
        ],
    };
}

/**
 * Handle the "kanbn_find_simple_tasks" MCP tool call: find non-file (simple) tasks by title.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnFindSimpleTasks(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const findFn = instance.findSimpleTasks || instance.listSimpleTasks;
    if (typeof findFn !== "function") {
        throw new TypeError(`No findSimpleTasks method found on Kanbn instance`);
    }

    const input = args.input as string | undefined;
    const tasks = input ? await findFn.call(instance, input) : await findFn.call(instance, null);

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(tasks, null, 2),
            },
        ],
    };
}

/**
 * Handle the "kanbn_get_simple_task" MCP tool call: resolve exactly one simple task by title.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnGetSimpleTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const input = args.input as string;
    if (!input) {
        throw new Error(`Missing required parameter: input`);
    }

    const getFn = instance.getSimpleTask;
    if (typeof getFn !== "function") {
        throw new TypeError(`No getSimpleTask method found on Kanbn instance`);
    }

    const task = await getFn.call(instance, input);

    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(task, null, 2),
            },
        ],
    };
}

/**
 * Handle the "kanbn_move_simple_task" MCP tool call: move a simple task between columns.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnMoveSimpleTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const input = args.input as string;
    if (!input) {
        throw new Error(`Missing required parameter: input`);
    }
    const column = args.column as string;
    if (!column) {
        throw new Error(`Missing required parameter: column`);
    }

    const moveFn = instance.moveSimpleTask;
    if (typeof moveFn !== "function") {
        throw new TypeError(`No moveSimpleTask method found on Kanbn instance`);
    }

    const moved = await moveFn.call(instance, input, column, args.position ?? null);

    return {
        content: [
            {
                type: "text",
                text: `Moved simple task "${moved.text}" to column "${moved.toColumn}"`,
            },
        ],
    };
}

/**
 * Handle the "kanbn_move_simple_task_to_board" MCP tool call: move a simple task onto another board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnMoveSimpleTaskToBoard(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const input = args.input as string;
    if (!input) {
        throw new Error(`Missing required parameter: input`);
    }
    const targetSlug = args.targetSlug as string;
    if (!targetSlug) {
        throw new Error(`Missing required parameter: targetSlug`);
    }

    const moveFn = instance.moveSimpleTaskToBoard;
    if (typeof moveFn !== "function") {
        throw new TypeError(`No moveSimpleTaskToBoard method found on Kanbn instance`);
    }

    const moved = await moveFn.call(instance, input, targetSlug, args.column ?? null, args.position ?? null);

    return {
        content: [
            {
                type: "text",
                text: `Moved simple task "${moved.text}" to board "${moved.toBoard}" column "${moved.toColumn}"`,
            },
        ],
    };
}

/**
 * Handle the "kanbn_delete_simple_task" MCP tool call: remove a simple task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnDeleteSimpleTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const input = args.input as string;
    if (!input) {
        throw new Error(`Missing required parameter: input`);
    }

    const deleteFn = instance.deleteSimpleTask;
    if (typeof deleteFn !== "function") {
        throw new TypeError(`No deleteSimpleTask method found on Kanbn instance`);
    }

    const removed = await deleteFn.call(instance, input);

    return {
        content: [
            {
                type: "text",
                text: `Deleted simple task "${removed.text}"`,
            },
        ],
    };
}

/**
 * Handle the "kanbn_promote_simple_task" MCP tool call: convert a simple task into a task file.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnPromoteSimpleTask(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const input = args.input as string;
    if (!input) {
        throw new Error(`Missing required parameter: input`);
    }

    const promoteFn = instance.promoteSimpleTask;
    if (typeof promoteFn !== "function") {
        throw new TypeError(`No promoteSimpleTask method found on Kanbn instance`);
    }

    const taskId = await promoteFn.call(instance, input, args.column ?? null);

    return {
        content: [
            {
                type: "text",
                text: `Promoted simple task "${input}" to task (id: ${taskId})`,
            },
        ],
    };
}

/**
 * Handle the "kanbn_create_board" MCP tool call: create a secondary board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnCreateBoard(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const slug = args.slug as string;
    if (!slug) {
        throw new Error(`Missing required parameter: slug`);
    }
    const createFn = instance.createBoard;
    if (typeof createFn !== "function") {
        throw new TypeError(`No createBoard method found on Kanbn instance`);
    }
    const options: Record<string, any> = {};
    if (args.name) options.name = args.name;
    if (args.description !== undefined) options.description = args.description;
    if (Array.isArray(args.columns) && args.columns.length) options.columns = args.columns;
    if (args.options && typeof args.options === "object") options.options = args.options;

    const createdSlug = await createFn.call(instance, slug, options);
    return {
        content: [{ type: "text", text: `Created board "${createdSlug}"` }],
    };
}

/**
 * Handle the "kanbn_delete_board_file" MCP tool call: remove a secondary board file, returning orphaned task ids.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnDeleteBoardFile(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const slug = args.slug as string;
    if (!slug) {
        throw new Error(`Missing required parameter: slug`);
    }
    const deleteFn = instance.deleteBoard;
    if (typeof deleteFn !== "function") {
        throw new TypeError(`No deleteBoard method found on Kanbn instance`);
    }
    const orphaned = await deleteFn.call(instance, slug);
    return {
        content: [
            {
                type: "text",
                text: orphaned.length
                    ? `Deleted board "${slug}". Orphaned tasks: ${orphaned.join(", ")}`
                    : `Deleted board "${slug}" (no orphaned tasks)`,
            },
        ],
    };
}

/**
 * Handle the "kanbn_rename_board" MCP tool call: rename a secondary board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnRenameBoard(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const slug = args.slug as string;
    if (!slug) {
        throw new Error(`Missing required parameter: slug`);
    }
    const newSlug = args.newSlug as string;
    if (!newSlug) {
        throw new Error(`Missing required parameter: newSlug`);
    }
    const renameFn = instance.renameBoard;
    if (typeof renameFn !== "function") {
        throw new TypeError(`No renameBoard method found on Kanbn instance`);
    }
    const renamedSlug = await renameFn.call(instance, slug, newSlug, args.newName ?? null);
    return {
        content: [{ type: "text", text: `Renamed board "${slug}" to "${renamedSlug}"` }],
    };
}

/**
 * Handle the "kanbn_list_boards" MCP tool call: list all boards.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnListBoards(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const boards = await instance.listBoards();
    return {
        content: [{ type: "text", text: JSON.stringify(boards, null, 2) }],
    };
}

/**
 * Handle the "kanbn_boards_summary" MCP tool call: return per-board task statistics.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnBoardsSummary(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const summaries = await instance.getBoardsSummary();
    return {
        content: [{ type: "text", text: JSON.stringify(summaries, null, 2) }],
    };
}

/**
 * Handle the "kanbn_board_exists" MCP tool call: check whether a board exists by slug.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnBoardExists(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const slug = args.slug as string;
    if (!slug) {
        throw new Error(`Missing required parameter: slug`);
    }
    const exists = await instance.boardExists(slug);
    return {
        content: [{ type: "text", text: String(exists) }],
    };
}

/**
 * Handle the "kanbn_reserved_board_slugs" MCP tool call: list reserved board slugs.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnReservedBoardSlugs(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const reserved = await instance.getReservedBoardSlugs();
    return {
        content: [{ type: "text", text: JSON.stringify(reserved, null, 2) }],
    };
}

/**
 * Handle the "kanbn_validate_board_slug" MCP tool call: validate a proposed board slug.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnValidateBoardSlug(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const slug = args.slug as string;
    if (!slug) {
        throw new Error(`Missing required parameter: slug`);
    }
    const validated = await instance.validateBoardSlug(slug);
    return {
        content: [{ type: "text", text: `Board slug "${validated}" is valid` }],
    };
}

/**
 * Handle the "kanbn_find_orphaned_tasks" MCP tool call: find tasks only referenced by one board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnFindOrphanedTasks(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const slug = args.slug as string;
    if (!slug) {
        throw new Error(`Missing required parameter: slug`);
    }
    const orphaned = await instance.findOrphanedTasks(slug);
    return {
        content: [{ type: "text", text: JSON.stringify(orphaned, null, 2) }],
    };
}

/**
 * Handle the "kanbn_cross_board_tasks" MCP tool call: find tasks that appear on more than one board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnCrossBoardTasks(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const crossBoard = await instance.getCrossBoardTasks(args.allTasks ?? false);
    return {
        content: [{ type: "text", text: JSON.stringify(crossBoard, null, 2) }],
    };
}

/**
 * Handle the "kanbn_tasks_on_other_boards" MCP tool call: map every task to other boards referencing it.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnTasksOnOtherBoards(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    const tasksOnBoards = await instance.findTasksOnOtherBoards();
    return {
        content: [{ type: "text", text: JSON.stringify(tasksOnBoards, null, 2) }],
    };
}

const VALID_SORT_FIELDS = ["name", "created", "modified", "due", "assigned", "progress"];
const VALID_SORT_ORDERS = ["ascending", "descending"];

/**
 * Handle the "kanbn_sort_column" MCP tool call: sort a board column by the given sorters.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnSortColumn(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const columnName = args.columnName as string;
    if (!columnName) {
        throw new Error(`Missing required parameter: columnName`);
    }
    if (!Array.isArray(args.sorters)) {
        throw new Error(`Missing required parameter: sorters`);
    }

    const sorters = args.sorters.map((sorter: any) => {
        if (!VALID_SORT_FIELDS.includes(sorter.field)) {
            throw new Error(`Invalid sort field: ${sorter.field}`);
        }
        const order = sorter.order ?? "ascending";
        if (!VALID_SORT_ORDERS.includes(order)) {
            throw new Error(`Invalid sort order: ${order}`);
        }
        const normalized: Record<string, any> = {
            field: sorter.field === "modified" ? "updated" : sorter.field,
            order,
        };
        if (sorter.filter !== undefined) {
            normalized.filter = sorter.filter;
        }
        return normalized;
    });

    await instance.sort(columnName, sorters, args.save ?? false);

    const index = await instance.getIndex();
    const tasks = index.columns[columnName] ?? [];
    return {
        content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
    };
}

/**
 * Handle the "kanbn_comment" MCP tool call: add a comment to a task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleKanbnComment(args: Record<string, any>) {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }

    const taskId = args.taskId as string;
    if (!taskId) {
        throw new Error(`Missing required parameter: taskId`);
    }
    const text = args.text as string;
    if (typeof text !== "string" || text.length === 0) {
        throw new Error(`Missing required parameter: text`);
    }

    const author = (args.author as string) ?? (await instance.currentUser()) ?? "";
    await instance.comment(taskId, text, author);

    return {
        content: [{ type: "text", text: `Commented on task "${taskId}"` }],
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
        // Deliberate alias for kanbn_init_board, kept for MCP client compatibility: some clients
        // registered this tool name and removing it would break them. kanbn_init_board is canonical;
        // keep this entry, its dispatch case and the shared handler in sync with it.
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
                            text: { type: "string", description: "Sub-task text (primary field)" },
                            name: { type: "string", description: "Deprecated alias for text; ignored when text is set" },
                            description: { type: "string", description: "Deprecated alias for text; ignored when text or name is set" },
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
        name: "kanbn_rename_task",
        description: "Rename an existing task on the Kanbn board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskId: { type: "string", description: "ID or filename of the task to rename" },
                newName: { type: "string", description: "New task title" },
                column: { type: "string", description: "Optional column to move the task into after renaming" },
                position: { type: "number", description: "Optional position within the target column" },
            },
            required: ["taskId", "newName"],
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
                            text: { type: "string", description: "Sub-task text (primary field)" },
                            name: { type: "string", description: "Deprecated alias for text; ignored when text is set" },
                            description: { type: "string", description: "Deprecated alias for text; ignored when text or name is set" },
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
            required: ["path"],
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
    {
        name: "kanbn_find_simple_tasks",
        description: "Find simple tasks (non-file column lines) by title, or all on the board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                input: { type: "string", description: "Title to match, or omit for every simple task" },
            },
        },
    },
    {
        name: "kanbn_get_simple_task",
        description: "Resolve exactly one simple task by title, or throw.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                input: { type: "string", description: "Title to match" },
            },
            required: ["input"],
        },
    },
    {
        name: "kanbn_move_simple_task",
        description: "Move a simple task to another column.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                input: { type: "string", description: "Title to match" },
                column: { type: "string", description: "Column to move the simple task into" },
                position: { type: "number", description: "Position within the target column" },
            },
            required: ["input", "column"],
        },
    },
    {
        name: "kanbn_move_simple_task_to_board",
        description: "Move a simple task onto another board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                input: { type: "string", description: "Title to match" },
                targetSlug: { type: "string", description: "Board slug to move the simple task to" },
                column: { type: "string", description: "Column on the target board (defaults to its first column)" },
                position: { type: "number", description: "Position within the target column" },
            },
            required: ["input", "targetSlug"],
        },
    },
    {
        name: "kanbn_delete_simple_task",
        description: "Remove a simple task from the board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                input: { type: "string", description: "Title to match" },
            },
            required: ["input"],
        },
    },
    {
        name: "kanbn_promote_simple_task",
        description: "Convert a simple task into a real task file.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                input: { type: "string", description: "Title to match" },
                column: { type: "string", description: "Column to create the task in (defaults to its own column)" },
            },
            required: ["input"],
        },
    },
    {
        name: "kanbn_create_board",
        description: "Create a new secondary board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                slug: { type: "string", description: "Board slug" },
                name: { type: "string", description: "Display name" },
                description: { type: "string", description: "Board description" },
                columns: { type: "array", items: { type: "string" }, description: "Initial board columns" },
                options: { type: "object", description: "Low-level board options" },
            },
            required: ["slug"],
        },
    },
    {
        name: "kanbn_delete_board_file",
        description: "Delete a secondary board file, returning orphaned task IDs.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                slug: { type: "string", description: "Board slug to delete" },
            },
            required: ["slug"],
        },
    },
    {
        name: "kanbn_rename_board",
        description: "Rename a secondary board (slug and/or display name).",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                slug: { type: "string", description: "Current board slug" },
                newSlug: { type: "string", description: "New board slug" },
                newName: { type: "string", description: "New display name" },
            },
            required: ["slug", "newSlug"],
        },
    },
    {
        name: "kanbn_list_boards",
        description: "List all boards in the workspace.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
            },
        },
    },
    {
        name: "kanbn_boards_summary",
        description: "Get a summary with per-board task statistics.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
            },
        },
    },
    {
        name: "kanbn_board_exists",
        description: "Check whether a board exists.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                slug: { type: "string", description: "Board slug" },
            },
            required: ["slug"],
        },
    },
    {
        name: "kanbn_reserved_board_slugs",
        description: "List the board slugs reserved by Kanbn.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
            },
        },
    },
    {
        name: "kanbn_validate_board_slug",
        description: "Validate a proposed board slug, throwing on invalid or reserved values.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                slug: { type: "string", description: "Board slug to validate" },
            },
            required: ["slug"],
        },
    },
    {
        name: "kanbn_find_orphaned_tasks",
        description: "Find tasks only referenced by one board (would orphan on its deletion).",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                slug: { type: "string", description: "Board slug" },
            },
            required: ["slug"],
        },
    },
    {
        name: "kanbn_cross_board_tasks",
        description: "Find tasks that appear on more than one board.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                allTasks: { type: "boolean", description: "Include tasks on a single board" },
            },
        },
    },
    {
        name: "kanbn_tasks_on_other_boards",
        description: "Map every task to all other boards that reference it.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
            },
        },
    },
    {
        name: "kanbn_sort_column",
        description: "Sort a board column by the given sorters.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                columnName: {
                    type: "string",
                    description: "Name of the column to sort",
                },
                sorters: {
                    type: "array",
                    description: "List of sorter objects with field (name, created, modified, due, assigned, progress), order (ascending, descending) and optional filter",
                    items: {
                        type: "object",
                        properties: {
                            field: { type: "string", description: "Field to sort by" },
                            order: { type: "string", description: "Sort order (ascending or descending)" },
                            filter: { type: "string", description: "Optional filter regular expression" },
                        },
                    },
                },
                save: { type: "boolean", description: "Persist the sort order to the index (default false)" },
            },
            required: ["columnName", "sorters"],
        },
    },
    {
        name: "kanbn_comment",
        description: "Add a comment to a task.",
        inputSchema: {
            type: "object",
            properties: {
                path: { type: "string", description: "Path to the project root directory" },
                taskId: { type: "string", description: "ID or filename of the task to comment on" },
                text: { type: "string", description: "Comment text" },
                author: { type: "string", description: "Comment author (defaults to KANBN_USER or git identity)" },
            },
            required: ["taskId", "text"],
        },
    },
];

/**
 * List the available MCP tools.
 * @returns {{tools: Tool[]}} An object containing the tool definitions
 */
export function listTools() {
    return { tools: TOOLS };
}

/**
 * Dispatch an MCP tool call by name.
 * @param {string} name The tool name
 * @param {Record<string, any>} [args] The tool arguments
 * @returns {Promise<{content: {type: string; text: string}[]}>} The MCP content response
 */
export async function handleToolCall(name: string, args: Record<string, any> = {}) {
    return enqueueKanbnOperation(async () => {
        switch (name) {
            case "kanbn_status":
                return handleKanbnStatus(args);
            case "kanbn_init_board":
            case "kanbn_initialize_board": // alias for kanbn_init_board (MCP client compatibility)
                return handleKanbnInitBoard(args);
            case "kanbn_ensure_board":
                return handleKanbnEnsureBoard(args);
            case "kanbn_create_task":
                return handleKanbnCreateTask(args);
            case "kanbn_move_task":
                return handleKanbnMoveTask(args);
            case "kanbn_rename_task":
                return handleKanbnRenameTask(args);
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
            case "kanbn_find_simple_tasks":
                return handleKanbnFindSimpleTasks(args);
            case "kanbn_get_simple_task":
                return handleKanbnGetSimpleTask(args);
            case "kanbn_move_simple_task":
                return handleKanbnMoveSimpleTask(args);
            case "kanbn_move_simple_task_to_board":
                return handleKanbnMoveSimpleTaskToBoard(args);
            case "kanbn_delete_simple_task":
                return handleKanbnDeleteSimpleTask(args);
            case "kanbn_promote_simple_task":
                return handleKanbnPromoteSimpleTask(args);
            case "kanbn_create_board":
                return handleKanbnCreateBoard(args);
            case "kanbn_delete_board_file":
                return handleKanbnDeleteBoardFile(args);
            case "kanbn_rename_board":
                return handleKanbnRenameBoard(args);
            case "kanbn_list_boards":
                return handleKanbnListBoards(args);
            case "kanbn_boards_summary":
                return handleKanbnBoardsSummary(args);
            case "kanbn_board_exists":
                return handleKanbnBoardExists(args);
            case "kanbn_reserved_board_slugs":
                return handleKanbnReservedBoardSlugs(args);
            case "kanbn_validate_board_slug":
                return handleKanbnValidateBoardSlug(args);
            case "kanbn_find_orphaned_tasks":
                return handleKanbnFindOrphanedTasks(args);
            case "kanbn_cross_board_tasks":
                return handleKanbnCrossBoardTasks(args);
            case "kanbn_tasks_on_other_boards":
                return handleKanbnTasksOnOtherBoards(args);
            case "kanbn_sort_column":
                return handleKanbnSortColumn(args);
            case "kanbn_comment":
                return handleKanbnComment(args);
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

export const HELP_TEXT = `kanbn-mcp ${version} - A Model Context Protocol server for Kanbn board management

USAGE
  node dist/server.js [options]

OPTIONS
  -h, --help       Show this help message
  -v, --version    Print the version number
  --run-server     Start the MCP server even when the entry script is not
                   named 'server' (e.g. launches via npx or a renamed build)

Run with no options to start the MCP server over stdio. The server starts
when the entry script's filename contains "server" or --run-server is passed.

ENVIRONMENT
  KANBN_DEFAULT_PATH   Optional. Default board directory (must contain a .kanbn
                       folder). If unset, defaults to the server's current
                       working directory - usually the project the MCP host
                       launched the server from, which keeps boards
                       per project. Individual tools can override this
                       per-call with a "path" argument.

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
  kanbn_sort_column, kanbn_comment

MCP CLIENT CONFIGURATION

  opencode (project or ~/.config/opencode/opencode.json / opencode.jsonc):

    {
      "mcp": {
        "kanbn": {
          "type": "local",
          "command": ["node", "/absolute/path/to/kanbn-mcp/dist/server.js"],
          "enabled": true
        }
      }
    }

  Claude Desktop / other "mcpServers" hosts (e.g. claude_desktop_config.json):

    {
      "mcpServers": {
        "kanbn": {
          "command": "node",
          "args": ["/absolute/path/to/kanbn-mcp/dist/server.js"]
        }
      }
    }

  In both cases the board root (the directory containing .kanbn) is taken from
  the server's working directory, so each project configures its own board.
  To force a fixed board regardless of working directory, add an optional
  environment entry:

    opencode:     "environment": { "KANBN_DEFAULT_PATH": "/path/to/project-root" }
    mcpServers:   "env": { "KANBN_DEFAULT_PATH": "/path/to/project-root" }

  KANBN_DEFAULT_PATH should point at the project root that contains the
  .kanbn directory, not into .kanbn itself.
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
async function main() {
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
    if (argv.includes("--run-server")) {
        return true;
    }
    const base = path.basename(script).toLowerCase();
    return base.includes("server");
}

if (isMainEntry()) {
    const cliArgs = new Set(process.argv.slice(2));
    if (cliArgs.has("--help") || cliArgs.has("-h")) {
        printHelp();
        process.exit(0);
    }
    if (cliArgs.has("--version") || cliArgs.has("-v")) {
        console.log(version);
        process.exit(0);
    }
    main().catch((err) => {
        console.error("Fatal error starting kanbn-mcp server:", err);
        process.exit(1);
    });
}