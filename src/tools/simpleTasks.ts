import { getRequiredString } from "../kanbn/args.js";
import { readyBoard } from "../kanbn/instance.js";
import { jsonResponse, McpResponse, textResponse } from "../kanbn/response.js";
import { PATH_PROPERTY } from "../kanbn/schema.js";
import { defineTool, ToolDefinition, ToolHandler } from "../types.js";

/**
 * Handle the "kanbn_find_simple_tasks" MCP tool call: find non-file (simple) tasks by title.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnFindSimpleTasks: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);

    const findFn = instance.findSimpleTasks || instance.listSimpleTasks;
    if (typeof findFn !== "function") {
        throw new TypeError(`No findSimpleTasks method found on Kanbn instance`);
    }

    const input = args.input as string | undefined;
    const tasks = input ? await findFn.call(instance, input) : await findFn.call(instance, null);

    return jsonResponse(tasks);
};

/**
 * Handle the "kanbn_get_simple_task" MCP tool call: resolve exactly one simple task by title.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnGetSimpleTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const input = getRequiredString(args, "input");

    const getFn = instance.getSimpleTask;
    if (typeof getFn !== "function") {
        throw new TypeError(`No getSimpleTask method found on Kanbn instance`);
    }

    const task = await getFn.call(instance, input);

    return jsonResponse(task);
};

/**
 * Handle the "kanbn_move_simple_task" MCP tool call: move a simple task between columns.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnMoveSimpleTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const input = getRequiredString(args, "input");
    const column = getRequiredString(args, "column");

    const moveFn = instance.moveSimpleTask;
    if (typeof moveFn !== "function") {
        throw new TypeError(`No moveSimpleTask method found on Kanbn instance`);
    }

    const moved = await moveFn.call(instance, input, column, args.position ?? null);

    return textResponse(`Moved simple task "${moved.text}" to column "${moved.toColumn}"`);
};

/**
 * Handle the "kanbn_move_simple_task_to_board" MCP tool call: move a simple task onto another board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnMoveSimpleTaskToBoard: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const input = getRequiredString(args, "input");
    const targetSlug = getRequiredString(args, "targetSlug");

    const moveFn = instance.moveSimpleTaskToBoard;
    if (typeof moveFn !== "function") {
        throw new TypeError(`No moveSimpleTaskToBoard method found on Kanbn instance`);
    }

    const moved = await moveFn.call(instance, input, targetSlug, args.column ?? null, args.position ?? null);

    return textResponse(`Moved simple task "${moved.text}" to board "${moved.toBoard}" column "${moved.toColumn}"`);
};

/**
 * Handle the "kanbn_delete_simple_task" MCP tool call: remove a simple task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnDeleteSimpleTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const input = getRequiredString(args, "input");

    const deleteFn = instance.deleteSimpleTask;
    if (typeof deleteFn !== "function") {
        throw new TypeError(`No deleteSimpleTask method found on Kanbn instance`);
    }

    const removed = await deleteFn.call(instance, input);

    return textResponse(`Deleted simple task "${removed.text}"`);
};

/**
 * Handle the "kanbn_promote_simple_task" MCP tool call: convert a simple task into a task file.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnPromoteSimpleTask: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const input = getRequiredString(args, "input");

    const promoteFn = instance.promoteSimpleTask;
    if (typeof promoteFn !== "function") {
        throw new TypeError(`No promoteSimpleTask method found on Kanbn instance`);
    }

    const taskId = await promoteFn.call(instance, input, args.column ?? null);

    return textResponse(`Promoted simple task "${input}" to task (id: ${taskId})`);
};

export const simpleTaskTools: ToolDefinition[] = [
    defineTool(
        "kanbn_find_simple_tasks",
        "Find simple tasks (non-file column lines) by title, or all on the board.",
        handleKanbnFindSimpleTasks,
        {
            path: PATH_PROPERTY,
            input: { type: "string", description: "Title to match, or omit for every simple task" },
        },
    ),
    defineTool(
        "kanbn_get_simple_task",
        "Resolve exactly one simple task by title, or throw.",
        handleKanbnGetSimpleTask,
        {
            path: PATH_PROPERTY,
            input: { type: "string", description: "Title to match" },
        },
        ["input"],
    ),
    defineTool(
        "kanbn_move_simple_task",
        "Move a simple task to another column.",
        handleKanbnMoveSimpleTask,
        {
            path: PATH_PROPERTY,
            input: { type: "string", description: "Title to match" },
            column: { type: "string", description: "Column to move the simple task into" },
            position: { type: "number", description: "Position within the target column" },
        },
        ["input", "column"],
    ),
    defineTool(
        "kanbn_move_simple_task_to_board",
        "Move a simple task onto another board.",
        handleKanbnMoveSimpleTaskToBoard,
        {
            path: PATH_PROPERTY,
            input: { type: "string", description: "Title to match" },
            targetSlug: { type: "string", description: "Board slug to move the simple task to" },
            column: { type: "string", description: "Column on the target board (defaults to its first column)" },
            position: { type: "number", description: "Position within the target column" },
        },
        ["input", "targetSlug"],
    ),
    defineTool(
        "kanbn_delete_simple_task",
        "Remove a simple task from the board.",
        handleKanbnDeleteSimpleTask,
        {
            path: PATH_PROPERTY,
            input: { type: "string", description: "Title to match" },
        },
        ["input"],
    ),
    defineTool(
        "kanbn_promote_simple_task",
        "Convert a simple task into a real task file.",
        handleKanbnPromoteSimpleTask,
        {
            path: PATH_PROPERTY,
            input: { type: "string", description: "Title to match" },
            column: { type: "string", description: "Column to create the task in (defaults to its own column)" },
        },
        ["input"],
    ),
];