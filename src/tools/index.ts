import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { enqueueKanbnOperation } from "../kanbn/queue.js";
import type { McpResponse } from "../kanbn/response.js";
import type { ToolDefinition } from "../types.js";
import { burndownTool, searchTool } from "./analytics.js";
import { commentTool, deleteBoardTool, secondaryBoardTools, setupTools, sortColumnTool } from "./board.js";
import { configTools } from "./config.js";
import { contributorTools } from "./contributors.js";
import { maintenanceTools } from "./maintenance.js";
import { simpleTaskTools } from "./simpleTasks.js";
import { sprintTools } from "./sprint.js";
import { archiveTools, taskTools } from "./task.js";

/**
 * Every tool definition, in the exact order the MCP client sees them. The per-category
 * modules each export their own definition arrays; ordering here is the source of truth
 * (and is pinned by the test suite).
 */
const definitions: ToolDefinition[] = [
    ...setupTools,
    ...taskTools,
    deleteBoardTool,
    ...archiveTools,
    ...simpleTaskTools,
    ...secondaryBoardTools,
    sortColumnTool,
    commentTool,
    ...configTools,
    searchTool,
    ...contributorTools,
    burndownTool,
    ...maintenanceTools,
    ...sprintTools,
];

const handlersByToolName = new Map(definitions.map((definition) => [definition.name, definition.handler]));

/**
 * The flattened MCP tool list (schema without handler), in canonical order.
 */
export const TOOLS: Tool[] = definitions.map(({ handler: _handler, ...tool }) => tool as Tool);

/**
 * List the available MCP tools.
 * @returns {{tools: Tool[]}} An object containing the tool definitions
 */
export function listTools(): { tools: Tool[]; } {
    return { tools: TOOLS };
}

/**
 * Dispatch an MCP tool call by name.
 * @param {string} name The tool name
 * @param {Record<string, any>} [args] The tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleToolCall(name: string, args: Record<string, any> = {}): Promise<McpResponse> {
    return enqueueKanbnOperation(async () => {
        const handler = handlersByToolName.get(name);
        if (!handler) {
            throw new Error(`Unknown tool requested: ${name}`);
        }
        return handler(args ?? {});
    });
}