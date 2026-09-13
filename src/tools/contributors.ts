import { readyBoard } from "../kanbn/instance.js";
import { jsonResponse, McpResponse, rethrowOperationError, textResponse } from "../kanbn/response.js";
import { PATH_PROPERTY } from "../kanbn/schema.js";
import { defineTool, ToolDefinition, ToolHandler } from "../types.js";

/**
 * Handle the "kanbn_get_contributors" MCP tool call: return the workspace's normalised contributors.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnGetContributors(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args, false);
    const contributors = await instance.getContributors();
    return jsonResponse(contributors);
}

/**
 * Handle the "kanbn_find_contributor" MCP tool call: match a value to a contributor.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnFindContributor(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args, false);
    if (typeof args.value !== "string") {
        throw new Error(`Missing required parameter: value`);
    }
    const contributor = await instance.findContributor(args.value);
    return jsonResponse(contributor);
}

/**
 * Handle the "kanbn_current_user" MCP tool call: resolve the current user value.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnCurrentUser(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args, false);
    const user = await instance.currentUser();
    const text = user === null || user === undefined ? "null" : String(user);
    return textResponse(text);
}

/**
 * Handle the "kanbn_collect_contributor_values" MCP tool call: collect every assigned/author value in use.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnCollectContributorValues(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args, false);
    try {
        const values = await instance.collectContributorValues();
        const entries = [...values.entries()].map(([key, entry]: [string, any]) => [
            key,
            { ...entry, tasks: [...entry.tasks].sort() },
        ]);
        return jsonResponse(Object.fromEntries(entries));
    } catch (error) {
        return rethrowOperationError(`Failed to collect contributor values`, error);
    }
}

/**
 * Handle the "kanbn_contributor_usage" MCP tool call: report how contributors are used.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnContributorUsage(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args, false);
    try {
        const usage = await instance.getContributorUsage();
        return jsonResponse(usage);
    } catch (error) {
        return rethrowOperationError(`Failed to get contributor usage`, error);
    }
}

/**
 * Handle the "kanbn_contributor_warnings" MCP tool call: find unknown contributor usages.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export async function handleKanbnContributorWarnings(args: Record<string, any>): Promise<McpResponse> {
    const { instance } = await readyBoard(args, false);
    try {
        const warnings = await instance.findContributorWarnings();
        return jsonResponse(warnings);
    } catch (error) {
        return rethrowOperationError(`Failed to find contributor warnings`, error);
    }
}

export const contributorTools: ToolDefinition[] = [
    defineTool(
        "kanbn_get_contributors",
        "Get the workspace's contributors, normalised to the object form.",
        handleKanbnGetContributors,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_find_contributor",
        "Find the contributor a value refers to, matching name, display name or aliases.",
        handleKanbnFindContributor,
        {
            path: PATH_PROPERTY,
            value: { type: "string", description: "The value to look up" },
        },
        ["value"],
    ),
    defineTool(
        "kanbn_current_user",
        "Resolve the current user (KANBN_USER, then git email/name when contributors are declared).",
        handleKanbnCurrentUser,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_collect_contributor_values",
        "Collect every distinct assigned/author value in use across task files.",
        handleKanbnCollectContributorValues,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_contributor_usage",
        "Report how the workspace's contributors are used, including spelling variants and unknown values.",
        handleKanbnContributorUsage,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_contributor_warnings",
        "Find tasks whose assigned user or comment author isn't a known contributor.",
        handleKanbnContributorWarnings,
        {
            path: PATH_PROPERTY,
        },
    ),
];