import { readyBoard } from "../kanbn/instance.js";
import { jsonResponse, McpResponse, rethrowOperationError } from "../kanbn/response.js";
import { PATH_PROPERTY } from "../kanbn/schema.js";
import { defineTool, ToolDefinition, ToolHandler } from "../types.js";

/**
 * Handle the "kanbn_add_untracked_task" MCP tool call: add an untracked task file to a column in the
 * index.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnAddUntrackedTask(args: Record<string, any>): Promise<McpResponse> {
    const taskId = args.taskId as string | undefined;
    const columnName = args.columnName as string | undefined;
    if (!taskId) {
        throw new Error("Missing required parameter: taskId");
    }
    if (!columnName) {
        throw new Error("Missing required parameter: columnName");
    }
    const { instance } = await readyBoard(args);
    try {
        const added = await instance.addUntrackedTaskToIndex(taskId, columnName);
        return jsonResponse(added, 0);
    } catch (error) {
        return rethrowOperationError(`Failed to add untracked task`, error);
    }
}

/**
 * Handle the "kanbn_find_tracked_tasks" MCP tool call: list tracked task ids, optionally filtered by
 * column.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnFindTrackedTasks(args: Record<string, any>): Promise<McpResponse> {
    const columnName = args.columnName as string | undefined;
    const { instance } = await readyBoard(args);
    try {
        const tracked = await instance.findTrackedTasks(columnName || null);
        return jsonResponse(Array.from(tracked as Iterable<string>), 0);
    } catch (error) {
        return rethrowOperationError(`Failed to find tracked tasks`, error);
    }
}

/**
 * Handle the "kanbn_find_untracked_tasks" MCP tool call: list task files that aren't in the index.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnFindUntrackedTasks(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args);
    try {
        const untracked = await instance.findUntrackedTasks();
        return jsonResponse(Array.from(untracked as Iterable<string>), 0);
    } catch (error) {
        return rethrowOperationError(`Failed to find untracked tasks`, error);
    }
}

/**
 * Handle the "kanbn_find_missing_task_files" MCP tool call: find indexed tasks whose file is missing.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnFindMissingTaskFiles(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args);
    try {
        const missing = await instance.findMissingTaskFiles();
        return jsonResponse(missing);
    } catch (error) {
        return rethrowOperationError(`Failed to find missing task files`, error);
    }
}

/**
 * Handle the "kanbn_add_task_to_board" MCP tool call: add an existing task file to this board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnAddTaskToBoard(args: Record<string, any>): Promise<McpResponse> {
    const taskId = args.taskId as string | undefined;
    const columnName = args.columnName as string | undefined;
    if (!taskId) {
        throw new Error("Missing required parameter: taskId");
    }
    if (!columnName) {
        throw new Error("Missing required parameter: columnName");
    }
    const { instance } = await readyBoard(args);
    try {
        const added = await instance.addTaskToBoard(taskId, columnName);
        return jsonResponse(added, 0);
    } catch (error) {
        return rethrowOperationError(`Failed to add task to board`, error);
    }
}

/**
 * Handle the "kanbn_find_task_boards" MCP tool call: list which boards and columns reference a task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnFindTaskBoards(args: Record<string, any>): Promise<McpResponse> {
    const taskId = args.taskId as string | undefined;
    if (!taskId) {
        throw new Error("Missing required parameter: taskId");
    }
    const { instance } = await readyBoard(args);
    try {
        const boards = await instance.findTaskBoards(taskId);
        return jsonResponse(boards);
    } catch (error) {
        return rethrowOperationError(`Failed to find task boards`, error);
    }
}

/**
 * Handle the "kanbn_task_file_exists" MCP tool call: check whether a task file exists.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnTaskFileExists(args: Record<string, any>): Promise<McpResponse> {
    const taskId = args.taskId as string | undefined;
    if (!taskId) {
        throw new Error("Missing required parameter: taskId");
    }
    const { instance } = await readyBoard(args);
    try {
        const exists = await instance.taskFileExists(taskId);
        return jsonResponse(exists, 0);
    } catch (error) {
        return rethrowOperationError(`Failed to check task file existence`, error);
    }
}

/**
 * Handle the "kanbn_task_exists" MCP tool call: check whether a task file exists and is indexed.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnTaskExists(args: Record<string, any>): Promise<McpResponse> {
    const taskId = args.taskId as string | undefined;
    if (!taskId) {
        throw new Error("Missing required parameter: taskId");
    }
    const { instance } = await readyBoard(args);
    try {
        await instance.taskExists(taskId);
        return jsonResponse(true, 0);
    } catch (error) {
        return rethrowOperationError(`Failed to check task existence`, error);
    }
}

/**
 * Handle the "kanbn_find_task_column" MCP tool call: find the column a task is in.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnFindTaskColumn(args: Record<string, any>): Promise<McpResponse> {
    const taskId = args.taskId as string | undefined;
    if (!taskId) {
        throw new Error("Missing required parameter: taskId");
    }
    const { instance } = await readyBoard(args);
    try {
        const column = await instance.findTaskColumn(taskId);
        return jsonResponse(column, 0);
    } catch (error) {
        return rethrowOperationError(`Failed to find task column`, error);
    }
}

/**
 * Handle the "kanbn_remove_all" MCP tool call: delete the whole board. Requires explicit confirmation.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnRemoveAll(args: Record<string, any>): Promise<McpResponse> {
    if (args.confirm !== true) {
        throw new Error("Failed to remove all: deletion requires confirmation (pass confirm: true)");
    }
    const { instance, boardPath } = await readyBoard(args);
    try {
        await instance.removeAll();
        return jsonResponse({ deleted: true, path: boardPath });
    } catch (error) {
        return rethrowOperationError(`Failed to remove all`, error);
    }
}

export const maintenanceTools: ToolDefinition[] = [
    defineTool(
        "kanbn_add_untracked_task",
        "Add an untracked task file to a column in the index.",
        handleKanbnAddUntrackedTask,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the untracked task" },
            columnName: { type: "string", description: "Column to add the task to" },
        },
        ["taskId", "columnName"],
    ),
    defineTool(
        "kanbn_find_tracked_tasks",
        "List tracked task IDs, optionally filtered by column.",
        handleKanbnFindTrackedTasks,
        {
            path: PATH_PROPERTY,
            columnName: { type: "string", description: "Optional column name to filter tasks by" },
        },
    ),
    defineTool(
        "kanbn_find_untracked_tasks",
        "List task files that aren't in the index.",
        handleKanbnFindUntrackedTasks,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_find_missing_task_files",
        "Find indexed tasks whose file is missing, as {task, column} entries.",
        handleKanbnFindMissingTaskFiles,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_add_task_to_board",
        "Add an existing task file to this board.",
        handleKanbnAddTaskToBoard,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task" },
            columnName: { type: "string", description: "Column to add the task to" },
        },
        ["taskId", "columnName"],
    ),
    defineTool(
        "kanbn_find_task_boards",
        "Find which boards and columns reference a task.",
        handleKanbnFindTaskBoards,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task" },
        },
        ["taskId"],
    ),
    defineTool(
        "kanbn_task_file_exists",
        "Check whether a task file exists, regardless of whether any board references it.",
        handleKanbnTaskFileExists,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task" },
        },
        ["taskId"],
    ),
    defineTool(
        "kanbn_task_exists",
        "Check that a task file exists and is indexed; throws otherwise.",
        handleKanbnTaskExists,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task" },
        },
        ["taskId"],
    ),
    defineTool(
        "kanbn_find_task_column",
        "Find the column a task is in, or throw if the task doesn't exist or isn't indexed.",
        handleKanbnFindTaskColumn,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task" },
        },
        ["taskId"],
    ),
    defineTool(
        "kanbn_remove_all",
        "Delete the whole board and all its data. Requires confirm: true.",
        handleKanbnRemoveAll,
        {
            path: PATH_PROPERTY,
            confirm: { type: "boolean", description: "Must be true to run the deletion" },
        },
        ["confirm"],
    ),
];