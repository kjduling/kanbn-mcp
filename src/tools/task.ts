import { getRequiredString } from "../kanbn/args.js";
import { getIndexMethod, readyBoard } from "../kanbn/instance.js";
import { jsonResponse, McpResponse, textResponse } from "../kanbn/response.js";
import { COMMENTS_PROPERTY, PATH_PROPERTY, SUBTASKS_PROPERTY } from "../kanbn/schema.js";
import { buildTaskDataFromArgs } from "../kanbn/taskData.js";
import { aliasTool, defineTool, ToolDefinition, ToolHandler } from "../types.js";

/**
 * Handle the "kanbn_create_task" MCP tool call: create a task, falling back to the first column
 * when none is given.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnCreateTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);

    const taskData = buildTaskDataFromArgs(args);
    let column = args.column || args.col || taskData.column || taskData.metadata?.column;

    if (taskData.metadata) {
        delete taskData.metadata.column;
    }
    delete taskData.column;

    if (!column) {
        // Column fallback: read the board index and pick its first column. Failing loudly here beats
        // creating a column-less task the caller never asked for.
        try {
            const getIndexFn = getIndexMethod(instance);
            if (typeof getIndexFn === "function") {
                const index = await getIndexFn.call(instance);
                const cols = index?.columns ? (Array.isArray(index.columns) ? index.columns : Object.keys(index.columns)) : [];
                if (cols.length > 0) {
                    column = typeof cols[0] === "string" ? cols[0] : (cols[0].name || cols[0].id);
                }
            }
        } catch (error) {
            throw new Error(`Failed to determine fallback column for kanbn_create_task: ${(error as Error).message}`);
        }
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

    return textResponse(`Created task "${taskName}" (${taskIdStr})`);
};

/**
 * Handle the "kanbn_delete_task" MCP tool call: delete a task (or act on an already-archived one).
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnDeleteTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const taskId = getRequiredString(args, "taskId");

    const force = Boolean(args.force);

    const deleteFn = instance.deleteTask || instance.removeTask || instance.delete;
    if (typeof deleteFn !== "function") {
        throw new TypeError(`No deleteTask method found on Kanbn instance`);
    }

    await deleteFn.call(instance, taskId, force);

    return textResponse(`Deleted task "${taskId}"${force ? " (forced)" : ""}`);
};

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
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnArchiveTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const taskId = getRequiredString(args, "taskId");

    const archiveFn = getArchiveMethod(instance);
    if (typeof archiveFn !== "function") {
        throw new TypeError(`No archiveTask method found on Kanbn instance`);
    }

    await archiveFn.call(instance, taskId);

    return textResponse(`Archived task "${taskId}"`);
};

/**
 * Handle the "kanbn_unarchive_task" / "kanbn_restore_task" MCP tool call: unarchive a task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnUnarchiveTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const taskId = getRequiredString(args, "taskId");

    const restoreFn = instance.restoreTask || instance.restore || instance.unarchiveTask;
    if (typeof restoreFn !== "function") {
        throw new TypeError(`No restoreTask method found on Kanbn instance`);
    }

    await restoreFn.call(instance, taskId);

    return textResponse(`Unarchived task "${taskId}"`);
};

/**
 * Handle the "kanbn_get_task" MCP tool call: retrieve a task by id.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnGetTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const taskId = getRequiredString(args, "taskId");

    const getFn = instance.getTask || instance.get || instance.fetchTask;
    if (typeof getFn !== "function") {
        throw new TypeError(`No getTask method found on Kanbn instance`);
    }

    const task = await getFn.call(instance, taskId);

    return jsonResponse(task);
};

/**
 * Handle the "kanbn_edit_task" MCP tool call: edit fields on an existing task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnEditTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const taskId = getRequiredString(args, "taskId");

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
        const getIndexFn = getIndexMethod(instance);
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

    return textResponse(`Edited task "${taskId}"`);
};

/**
 * Handle the "kanbn_move_task" MCP tool call: move a task between columns.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnMoveTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const taskId = args.taskId as string;
    const targetColumn = args.targetColumn || args.column || args.col;
    if (typeof taskId !== "string" || taskId.length === 0) {
        throw new Error(`Missing required parameter: taskId`);
    }
    if (typeof targetColumn !== "string" || targetColumn.length === 0) {
        throw new Error(`Missing required parameter: targetColumn`);
    }

    const moveFn = instance.moveTask || instance.move;
    if (typeof moveFn !== "function") {
        throw new TypeError(`No moveTask method found on Kanbn instance`);
    }

    await moveFn.call(instance, taskId, targetColumn);

    return textResponse(`Moved task ${taskId} to column "${targetColumn}"`);
};

/**
 * Handle the "kanbn_rename_task" MCP tool call: rename a task, optionally moving it.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnRenameTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const taskId = getRequiredString(args, "taskId");
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

    return textResponse(`Renamed task ${taskId} to "${newName}" (new id: ${newTaskId})`);
};

const taskTools: ToolDefinition[] = [
    defineTool(
        "kanbn_create_task",
        "Create a new task on the Kanbn board. The 'name' field is required; all other fields are optional.",
        handleKanbnCreateTask,
        {
            path: PATH_PROPERTY,
            taskData: { type: "object", description: "Kanbn task metadata object" },
            column: { type: "string", description: "Target column for the new task (optional; defaults to the board's first column)" },
            name: { type: "string", description: "Task title (required)" },
            description: { type: "string", description: "Task detailed description" },
            assigned: { type: "string", description: "Assignee" },
            subTasks: SUBTASKS_PROPERTY,
            comments: COMMENTS_PROPERTY,
        },
        ["name"],
    ),
    defineTool(
        "kanbn_move_task",
        "Move an existing task to a different column.",
        handleKanbnMoveTask,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task" },
            targetColumn: { type: "string", description: "Column to move the task into" },
        },
        ["taskId", "targetColumn"],
    ),
    defineTool(
        "kanbn_rename_task",
        "Rename an existing task on the Kanbn board.",
        handleKanbnRenameTask,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task to rename" },
            newName: { type: "string", description: "New task title" },
            column: { type: "string", description: "Optional column to move the task into after renaming" },
            position: { type: "number", description: "Optional position within the target column" },
        },
        ["taskId", "newName"],
    ),
    defineTool(
        "kanbn_delete_task",
        "Delete a task from the Kanbn board.",
        handleKanbnDeleteTask,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task to delete" },
            force: { type: "boolean", description: "Force deletion without confirmation" },
        },
        ["taskId"],
    ),
    defineTool(
        "kanbn_archive_task",
        "Archive a task on the Kanbn board.",
        handleKanbnArchiveTask,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task to archive" },
        },
        ["taskId"],
    ),
    defineTool(
        "kanbn_get_task",
        "Retrieve details of a specific task from the Kanbn board.",
        handleKanbnGetTask,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task to retrieve" },
        },
        ["taskId"],
    ),
    defineTool(
        "kanbn_edit_task",
        "Edit an existing task on the Kanbn board.",
        handleKanbnEditTask,
        {
            path: PATH_PROPERTY,
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
            subTasks: SUBTASKS_PROPERTY,
            comments: COMMENTS_PROPERTY,
        },
        ["taskId"],
    ),
];

const unarchiveTaskTool = defineTool(
    "kanbn_unarchive_task",
    "Unarchive a task on the Kanbn board.",
    handleKanbnUnarchiveTask,
    {
        path: PATH_PROPERTY,
        taskId: { type: "string", description: "ID or filename of the task to unarchive" },
    },
    ["taskId"],
);

const archiveTools: ToolDefinition[] = [
    unarchiveTaskTool,
    aliasTool(unarchiveTaskTool, "kanbn_restore_task", "Alias for kanbn_unarchive_task."),
];

export { taskTools };
export { archiveTools };