import path from "node:path";

import { getRequiredString } from "../kanbn/args.js";
import {
    getIndexMethod,
    getKanbnInstance,
    getKanbnPath,
    isBoardInitialized,
    readyBoard,
} from "../kanbn/instance.js";
import {
    getMaxResponseSize,
    jsonResponse,
    McpResponse,
    textResponse,
    truncateResponse,
} from "../kanbn/response.js";
import { PATH_PROPERTY } from "../kanbn/schema.js";
import { aliasTool, defineTool, ToolDefinition, ToolHandler } from "../types.js";

/**
 * Handle the "kanbn_status" MCP tool call: return a board status summary, optionally
 * scoped by quiet/untracked/due/sprint/dates, and capped at the configured max size.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnStatus: ToolHandler = async (args) => {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    const initialized = await isBoardInitialized(instance, boardPath);
    if (!initialized) {
        return textResponse(`No Kanbn board found at: ${boardPath}`);
    }

    const quiet = args.quiet === true;
    const untracked = args.untracked === true;
    const due = args.due === true;
    const sprint = typeof args.sprint === "number" || typeof args.sprint === "string" && (args.sprint as string).length > 0 ? args.sprint : null;
    let dates: Date[] | null = null;
    if (args.dates !== undefined && args.dates !== null) {
        dates = (Array.isArray(args.dates) ? args.dates : [args.dates]).map((date: unknown) => {
            const parsed = new Date(String(date));
            if (isNaN(parsed.getTime())) {
                throw new Error(`Invalid date: "${String(date)}"`);
            }
            return parsed;
        });
    }

    let data: unknown;
    if (quiet || untracked || due || sprint !== null || dates !== null) {
        const statusFn = instance.status;
        if (typeof statusFn !== "function") {
            throw new Error("Failed to get status: no status method available on the Kanbn instance");
        }
        try {
            data = await statusFn.call(instance, quiet, untracked, due, sprint, dates);
        } catch (error) {
            throw new Error(`Failed to get status: ${(error as Error).message}`);
        }
    } else {
        const getIndexFn = getIndexMethod(instance);
        data = typeof getIndexFn === "function" ? await getIndexFn.call(instance) : {};
    }

    const maxSize = getMaxResponseSize();
    let serialized = JSON.stringify(data, null, 2);
    if (Buffer.byteLength(serialized) > maxSize) {
        serialized = JSON.stringify(data);
        if (Buffer.byteLength(serialized) > maxSize) {
            serialized = truncateResponse(serialized, maxSize);
        }
    }
    return textResponse(serialized);
};

/**
 * Handle the "kanbn_init_board" / "kanbn_initialize_board" MCP tool call: initialize a new board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnInitBoard: ToolHandler = async (args) => {
    const { instance, boardPath } = await readyBoard(args, false);
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

    return textResponse(`Successfully initialized Kanbn board at: ${boardPath}`);
};

/**
 * Handle the "kanbn_ensure_board" MCP tool call: initialize a board if one is absent.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnEnsureBoard: ToolHandler = async (args) => {
    const { instance, boardPath } = await readyBoard(args, false);
    const initialized = await isBoardInitialized(instance, boardPath);
    if (!initialized) {
        await handleKanbnInitBoard(args);
    }
    return textResponse(`Ensured Kanbn board exists at: ${boardPath}`);
};

/**
 * Handle the "kanbn_delete_board" MCP tool call: delete an entire board directory.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnDeleteBoard: ToolHandler = async (args) => {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const fs = await import("node:fs");

    if (!boardPath || boardPath === "/") {
        return textResponse("Cannot delete root directory.");
    }

    const kanbnDir = path.join(boardPath, ".kanbn");
    if (!fs.existsSync(kanbnDir)) {
        return textResponse(`Not a Kanbn board directory: ${boardPath} (no .kanbn folder found)`);
    }

    fs.rmSync(boardPath, { recursive: true, force: true });

    return textResponse(`Deleted board at: ${boardPath}`);
};

/**
 * Handle the "kanbn_create_board" MCP tool call: create a secondary board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnCreateBoard: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const slug = getRequiredString(args, "slug");
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
    return textResponse(`Created board "${createdSlug}"`);
};

/**
 * Handle the "kanbn_delete_board_file" MCP tool call: remove a secondary board file, returning orphaned task ids.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnDeleteBoardFile: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const slug = getRequiredString(args, "slug");
    const deleteFn = instance.deleteBoard;
    if (typeof deleteFn !== "function") {
        throw new TypeError(`No deleteBoard method found on Kanbn instance`);
    }
    const orphaned = await deleteFn.call(instance, slug);
    return textResponse(orphaned.length
        ? `Deleted board "${slug}". Orphaned tasks: ${orphaned.join(", ")}`
        : `Deleted board "${slug}" (no orphaned tasks)`);
};

/**
 * Handle the "kanbn_rename_board" MCP tool call: rename a secondary board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnRenameBoard: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const slug = getRequiredString(args, "slug");
    const newSlug = getRequiredString(args, "newSlug");
    const renameFn = instance.renameBoard;
    if (typeof renameFn !== "function") {
        throw new TypeError(`No renameBoard method found on Kanbn instance`);
    }
    const renamedSlug = await renameFn.call(instance, slug, newSlug, args.newName ?? null);
    return textResponse(`Renamed board "${slug}" to "${renamedSlug}"`);
};

/**
 * Handle the "kanbn_list_boards" MCP tool call: list all boards.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnListBoards: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const boards = await instance.listBoards();
    return jsonResponse(boards);
};

/**
 * Handle the "kanbn_boards_summary" MCP tool call: return per-board task statistics.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnBoardsSummary: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const summaries = await instance.getBoardsSummary();
    return jsonResponse(summaries);
};

/**
 * Handle the "kanbn_board_exists" MCP tool call: check whether a board exists by slug.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnBoardExists: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const slug = getRequiredString(args, "slug");
    const exists = await instance.boardExists(slug);
    return textResponse(String(exists));
};

/**
 * Handle the "kanbn_reserved_board_slugs" MCP tool call: list reserved board slugs.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnReservedBoardSlugs: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const reserved = await instance.getReservedBoardSlugs();
    return jsonResponse(reserved);
};

/**
 * Handle the "kanbn_validate_board_slug" MCP tool call: validate a proposed board slug.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnValidateBoardSlug: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const slug = getRequiredString(args, "slug");
    const validated = await instance.validateBoardSlug(slug);
    return textResponse(`Board slug "${validated}" is valid`);
};

/**
 * Handle the "kanbn_find_orphaned_tasks" MCP tool call: find tasks only referenced by one board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnFindOrphanedTasks: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const slug = getRequiredString(args, "slug");
    const orphaned = await instance.findOrphanedTasks(slug);
    return jsonResponse(orphaned);
};

/**
 * Handle the "kanbn_cross_board_tasks" MCP tool call: find tasks that appear on more than one board.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnCrossBoardTasks: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const crossBoard = await instance.getCrossBoardTasks(args.allTasks ?? false);
    return jsonResponse(crossBoard);
};

/**
 * Handle the "kanbn_tasks_on_other_boards" MCP tool call: map every task to other boards referencing it.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnTasksOnOtherBoards: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const tasksOnBoards = await instance.findTasksOnOtherBoards();
    return jsonResponse(tasksOnBoards);
};

const VALID_SORT_FIELDS = ["name", "created", "modified", "due", "assigned", "progress"];
const VALID_SORT_ORDERS = ["ascending", "descending"];

/**
 * Handle the "kanbn_sort_column" MCP tool call: sort a board column by the given sorters.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnSortColumn: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);

    const columnName = getRequiredString(args, "columnName");
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

    const index = await getIndexMethod(instance)!.call(instance);
    const tasks = index.columns[columnName] ?? [];
    return jsonResponse(tasks);
};

/**
 * Handle the "kanbn_comment" MCP tool call: add a comment to a task.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnComment: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);

    const taskId = getRequiredString(args, "taskId");
    const text = getRequiredString(args, "text");

    const author = (args.author as string) ?? (await instance.currentUser()) ?? "";
    await instance.comment(taskId, text, author);

    return textResponse(`Commented on task "${taskId}"`);
};

const statusTool = defineTool(
    "kanbn_status",
    "Check the current status of the Kanbn board, optionally scoped by the quiet, untracked, due, sprint and dates parameters (board detection checks the methods: initialised, initialized, isInitialized, isInitialised). The response is capped at 100KB by default (configurable via the KANBN_MAX_RESPONSE_SIZE environment variable, in bytes): oversized output automatically falls back to compact JSON, then is truncated with a truncation marker.",
    handleKanbnStatus,
    {
        path: PATH_PROPERTY,
        quiet: { type: "boolean", description: "Return partial status (task counts only)" },
        untracked: { type: "boolean", description: "Include a list of untracked task files (with quiet, returns just that list)" },
        due: { type: "boolean", description: "Show overdue tasks and time remaining" },
        sprint: { description: "Show sprint stats for a named or numbered (1-based) sprint; defaults to the current sprint when omitted", oneOf: [{ type: "string" }, { type: "number" }] },
        dates: { description: "Filter stats by a date range: a single ISO date or an array of two ISO dates", oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
    },
);

const initBoardTool = defineTool(
    "kanbn_init_board",
    "Initialize a new Kanbn board in the target directory.",
    handleKanbnInitBoard,
    {
        path: PATH_PROPERTY,
        name: { type: "string", description: "Name of the board" },
        columns: { type: "array", items: { type: "string" }, description: "Initial board columns" },
    },
);

const initializeBoardTool = aliasTool(
    initBoardTool,
    "kanbn_initialize_board",
    "Alias for kanbn_init_board.",
);

const ensureBoardTool = defineTool(
    "kanbn_ensure_board",
    "Ensure a Kanbn board exists, initializing one if absent (board detection checks the methods: initialised, initialized, isInitialized, isInitialised).",
    handleKanbnEnsureBoard,
    {
        path: PATH_PROPERTY,
        name: { type: "string", description: "Name of the board" },
        columns: { type: "array", items: { type: "string" }, description: "Initial board columns" },
    },
);

const deleteBoardTool = defineTool(
    "kanbn_delete_board",
    "Delete an entire Kanbn board directory.",
    handleKanbnDeleteBoard,
    {
        path: { type: "string", description: "Path to the board directory to delete" },
    },
    ["path"],
);

const secondaryBoardTools: ToolDefinition[] = [
    defineTool(
        "kanbn_create_board",
        "Create a new secondary board.",
        handleKanbnCreateBoard,
        {
            path: PATH_PROPERTY,
            slug: { type: "string", description: "Board slug" },
            name: { type: "string", description: "Display name" },
            description: { type: "string", description: "Board description" },
            columns: { type: "array", items: { type: "string" }, description: "Initial board columns" },
            options: { type: "object", description: "Low-level board options" },
        },
        ["slug"],
    ),
    defineTool(
        "kanbn_delete_board_file",
        "Delete a secondary board file, returning orphaned task IDs.",
        handleKanbnDeleteBoardFile,
        {
            path: PATH_PROPERTY,
            slug: { type: "string", description: "Board slug to delete" },
        },
        ["slug"],
    ),
    defineTool(
        "kanbn_rename_board",
        "Rename a secondary board (slug and/or display name).",
        handleKanbnRenameBoard,
        {
            path: PATH_PROPERTY,
            slug: { type: "string", description: "Current board slug" },
            newSlug: { type: "string", description: "New board slug" },
            newName: { type: "string", description: "New display name" },
        },
        ["slug", "newSlug"],
    ),
    defineTool(
        "kanbn_list_boards",
        "List all boards in the workspace.",
        handleKanbnListBoards,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_boards_summary",
        "Get a summary with per-board task statistics.",
        handleKanbnBoardsSummary,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_board_exists",
        "Check whether a board exists.",
        handleKanbnBoardExists,
        {
            path: PATH_PROPERTY,
            slug: { type: "string", description: "Board slug" },
        },
        ["slug"],
    ),
    defineTool(
        "kanbn_reserved_board_slugs",
        "List the board slugs reserved by Kanbn.",
        handleKanbnReservedBoardSlugs,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_validate_board_slug",
        "Validate a proposed board slug, throwing on invalid or reserved values.",
        handleKanbnValidateBoardSlug,
        {
            path: PATH_PROPERTY,
            slug: { type: "string", description: "Board slug to validate" },
        },
        ["slug"],
    ),
    defineTool(
        "kanbn_find_orphaned_tasks",
        "Find tasks only referenced by one board (would orphan on its deletion).",
        handleKanbnFindOrphanedTasks,
        {
            path: PATH_PROPERTY,
            slug: { type: "string", description: "Board slug" },
        },
        ["slug"],
    ),
    defineTool(
        "kanbn_cross_board_tasks",
        "Find tasks that appear on more than one board.",
        handleKanbnCrossBoardTasks,
        {
            path: PATH_PROPERTY,
            allTasks: { type: "boolean", description: "Include tasks on a single board" },
        },
    ),
    defineTool(
        "kanbn_tasks_on_other_boards",
        "Map every task to all other boards that reference it.",
        handleKanbnTasksOnOtherBoards,
        {
            path: PATH_PROPERTY,
        },
    ),
];

const sortColumnTool = defineTool(
    "kanbn_sort_column",
    "Sort a board column by the given sorters.",
    handleKanbnSortColumn,
    {
        path: PATH_PROPERTY,
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
    ["columnName", "sorters"],
);

const commentTool = defineTool(
    "kanbn_comment",
    "Add a comment to a task.",
    handleKanbnComment,
    {
        path: PATH_PROPERTY,
        taskId: { type: "string", description: "ID or filename of the task to comment on" },
        text: { type: "string", description: "Comment text" },
        author: { type: "string", description: "Comment author (defaults to KANBN_USER or git identity)" },
    },
    ["taskId", "text"],
);

export const setupTools: ToolDefinition[] = [statusTool, initBoardTool, initializeBoardTool, ensureBoardTool];

export { deleteBoardTool };
export { secondaryBoardTools };
export { sortColumnTool };
export { commentTool };