import { getIndexMethod, readyBoard } from "../kanbn/instance.js";
import { jsonResponse, McpResponse, rethrowOperationError } from "../kanbn/response.js";
import { PATH_PROPERTY } from "../kanbn/schema.js";
import { defineTool, ToolDefinition, ToolHandler } from "../types.js";

/**
 * Handle the "kanbn_start_sprint" MCP tool call: create a new sprint.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnStartSprint(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args);
    const name = typeof args.name === "string" ? args.name : "";
    const description = typeof args.description === "string" ? args.description : undefined;
    const start = typeof args.start === "string" && args.start.length > 0 ? args.start : undefined;

    let startDate: Date;
    if (start) {
        const parsed = new Date(start);
        if (isNaN(parsed.getTime())) {
            throw new Error(`Invalid date: "${start}"`);
        }
        startDate = parsed;
    } else {
        startDate = new Date();
    }

    if (name.length > 0) {
        const getIndexFn = getIndexMethod(instance);
        const index = typeof getIndexFn === "function" ? await getIndexFn.call(instance) : {};
        const existingNames = [
            ...((index.options && index.options.sprints) || []),
            ...((index.ownOptions && index.ownOptions.sprints) || []),
        ].map((sprint: { name?: string }) => sprint.name).filter((sprintName?: string) => sprintName);
        if (existingNames.includes(name)) {
            throw new Error(`Sprint "${name}" already exists`);
        }
    }

    try {
        const sprint = await instance.sprint(name, description, startDate);
        return jsonResponse(sprint);
    } catch (error) {
        return rethrowOperationError(`Failed to create sprint`, error);
    }
}

/**
 * Handle the "kanbn_list_archived_tasks" MCP tool call: list archived task ids.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnListArchivedTasks(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args);
    try {
        const taskIds = await instance.listArchivedTasks();
        return jsonResponse(taskIds, 0);
    } catch (error) {
        return rethrowOperationError(`Failed to list archived tasks`, error);
    }
}

/**
 * Handle the "kanbn_load_archived_task" MCP tool call: load a task from the archive.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnLoadArchivedTask(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args);
    const taskId = args.taskId;
    if (typeof taskId !== "string" || taskId.length === 0) {
        throw new Error(`Missing required parameter: taskId`);
    }
    try {
        const task = await instance.loadArchivedTask(taskId);
        return jsonResponse(task);
    } catch (error) {
        return rethrowOperationError(`Failed to load archived task`, error);
    }
}

export const sprintTools: ToolDefinition[] = [
    defineTool(
        "kanbn_start_sprint",
        "Start a new sprint on the Kanbn board. Accepts an optional name, description, and start date; a blank name generates 'Sprint N' and a blank start date defaults to now. Sprint names must be unique.",
        handleKanbnStartSprint,
        {
            path: PATH_PROPERTY,
            name: { type: "string", description: "Sprint name (optional; defaults to an auto-generated name)" },
            description: { type: "string", description: "Sprint description" },
            start: { type: "string", description: "Start date (ISO string; defaults to now)" },
        },
    ),
    defineTool(
        "kanbn_list_archived_tasks",
        "List the ids of tasks that have been archived.",
        handleKanbnListArchivedTasks,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_load_archived_task",
        "Load a task from the archive.",
        handleKanbnLoadArchivedTask,
        {
            path: PATH_PROPERTY,
            taskId: { type: "string", description: "ID or filename of the task to load" },
        },
        ["taskId"],
    ),
];