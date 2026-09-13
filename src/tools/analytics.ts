import { getBoardIndex, readyBoard } from "../kanbn/instance.js";
import { jsonResponse, McpResponse, rethrowOperationError } from "../kanbn/response.js";
import { PATH_PROPERTY } from "../kanbn/schema.js";
import { defineTool, ToolDefinition, ToolHandler } from "../types.js";

const SEARCH_STRING_FILTERS = ["id", "name", "description", "column", "assigned", "sub-task", "tag", "relation", "comment"];
const SEARCH_DATE_FILTERS = ["created", "updated", "started", "completed", "due", "plannedStart", "plannedFinish"];
const SEARCH_NUMBER_FILTERS = ["workload", "progress", "count-sub-tasks", "count-tags", "count-relations", "count-comments"];
const SEARCH_BOOLEAN_FILTERS = ["overdue", "is-started", "is-completed", "in-started-column", "in-completed-column"];

/**
 * Validate the search filters against the board's known filter keys, throwing on invalid filters.
 * @param {Record<string, any>} filters The filter object to validate
 * @param {any} index The board index (used for custom field filters)
 * @returns {void}
 */
function validateSearchFilters(filters: Record<string, any>, index: any): void {
    const customFieldKeys = (index?.options?.customFields ?? []).map((field: any) => field.name);
    const stringKeys = [...SEARCH_STRING_FILTERS, ...customFieldKeys];
    const allKeys = [...stringKeys, ...SEARCH_DATE_FILTERS, ...SEARCH_NUMBER_FILTERS, ...SEARCH_BOOLEAN_FILTERS];

    for (const key of Object.keys(filters)) {
        if (allKeys.indexOf(key) === -1) {
            throw new Error(`Invalid filter: "${key}" is not a valid filter`);
        }
        const value = filters[key];
        if (SEARCH_BOOLEAN_FILTERS.indexOf(key) !== -1) {
            if (!(typeof value === "boolean" || (Array.isArray(value) && value.every((v: any) => typeof v === "boolean")))) {
                throw new Error(`Invalid filter: "${key}" must be a boolean or an array of booleans`);
            }
        } else if (SEARCH_NUMBER_FILTERS.indexOf(key) !== -1) {
            if (!(typeof value === "number" || (Array.isArray(value) && value.every((v: any) => typeof v === "number")))) {
                throw new Error(`Invalid filter: "${key}" must be a number or an array of numbers`);
            }
        } else if (SEARCH_DATE_FILTERS.indexOf(key) !== -1) {
            if (!(typeof value === "string" || typeof value === "number" || (Array.isArray(value) && value.every((v: any) => typeof v === "string" || typeof v === "number")))) {
                throw new Error(`Invalid filter: "${key}" must be a date or an array of dates`);
            }
        } else if (!(typeof value === "string" || (Array.isArray(value) && value.every((v: any) => typeof v === "string")))) {
            throw new Error(`Invalid filter: "${key}" must be a matching string or an array of matching strings`);
        }
    }
}

/**
 * Handle the "kanbn_search" MCP tool call: search tasks across all columns with filters.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnSearch(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args);
    const filters = args.filters ?? {};
    if (filters === null || typeof filters !== "object" || Array.isArray(filters)) {
        throw new Error(`Invalid filters: expected an object, received ${filters === null ? "null" : Array.isArray(filters) ? "array" : typeof filters}`);
    }
    const index = await getBoardIndex(instance);
    validateSearchFilters(filters, index);
    try {
        const matches = await instance.search(filters, args.quiet === true);
        return jsonResponse(matches);
    } catch (error) {
        return rethrowOperationError(`Failed to search board`, error);
    }
}

const BURNDOWN_NORMALISE_MODES = ["auto", "days", "hours", "minutes", "seconds"];

/**
 * Handle the "kanbn_burndown" MCP tool call: return burndown chart data as an object.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnBurndown(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args);
    const sprints = args.sprints ?? null;
    const dates = args.dates ?? null;
    const assigned = args.assigned ?? null;
    const columns = args.columns ?? null;
    const normalise = args.normalise ?? null;
    if (normalise !== null && BURNDOWN_NORMALISE_MODES.indexOf(normalise) === -1) {
        throw new Error(`Invalid normalise mode: "${normalise}"`);
    }
    if (dates !== null) {
        if (!Array.isArray(dates) || dates.length === 0 || !dates.every((d) => typeof d === "string" || typeof d === "number")) {
            throw new Error(`Invalid dates: expected an array of dates`);
        }
        for (const value of dates) {
            if (isNaN(new Date(value as string | number).getTime())) {
                throw new Error(`Invalid date: "${value}"`);
            }
        }
    }
    if (columns !== null && !(Array.isArray(columns) && columns.every((c) => typeof c === "string"))) {
        throw new Error(`Invalid columns: expected an array of column names`);
    }
    if (sprints !== null && !(Array.isArray(sprints) && sprints.every((s) => typeof s === "string" || typeof s === "number"))) {
        throw new Error(`Invalid sprints: expected an array of sprint names or numbers`);
    }
    if (assigned !== null && typeof assigned !== "string") {
        throw new Error(`Invalid assigned: expected a user name`);
    }
    try {
        const data = await instance.burndown(sprints, dates, assigned, columns, normalise);
        return jsonResponse(data);
    } catch (error) {
        return rethrowOperationError(`Failed to get burndown data`, error);
    }
}

const searchTool = defineTool(
    "kanbn_search",
    "Search tasks on the board with filters (works across all columns).",
    handleKanbnSearch,
    {
        path: PATH_PROPERTY,
        filters: {
            type: "object",
            description: "Task filters: id, name, description, column, assigned, sub-task, tag, relation, comment (regex strings), created, updated, started, completed, due, plannedStart, plannedFinish (dates or ranges), workload, progress, count-sub-tasks, count-tags, count-relations, count-comments (numbers or ranges), overdue, is-started, is-completed, in-started-column, in-completed-column (booleans), plus any configured custom fields",
        },
        quiet: { type: "boolean", description: "If true, return only matching task IDs (default: false)" },
    },
);

const burndownTool = defineTool(
    "kanbn_burndown",
    "Get burndown chart data as an object.",
    handleKanbnBurndown,
    {
        path: PATH_PROPERTY,
        sprints: {
            type: "array",
            items: { oneOf: [{ type: "string" }, { type: "number" }] },
            description: "Sprint names or 1-based numbers to show charts for (defaults to the current sprint)",
        },
        dates: {
            type: "array",
            items: { oneOf: [{ type: "string" }, { type: "number" }] },
            description: "Dates defining a range to show a chart for (defaults to no date filter)",
        },
        assigned: { type: "string", description: "Only show tasks assigned to this user" },
        columns: {
            type: "array",
            items: { type: "string" },
            description: "Only show tasks in these columns",
        },
        normalise: {
            type: "string",
            enum: ["auto", "days", "hours", "minutes", "seconds"],
            description: "Date normalisation mode",
        },
    },
);

export { searchTool };
export { burndownTool };