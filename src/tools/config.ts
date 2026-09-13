import { getBoardIndex, readyBoard } from "../kanbn/instance.js";
import { jsonResponse, McpResponse, textResponse } from "../kanbn/response.js";
import { PATH_PROPERTY } from "../kanbn/schema.js";
import { defineTool, ToolDefinition, ToolHandler } from "../types.js";

/**
 * Handle the "kanbn_get_config" MCP tool call: return the board config or null.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnGetConfig: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const config = await instance.getConfig();
    return config === null || config === undefined ? textResponse("No config file found") : jsonResponse(config);
};

/**
 * Handle the "kanbn_save_config" MCP tool call: persist the board config.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnSaveConfig: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    if (typeof instance.saveConfig !== "function") {
        throw new TypeError(`No saveConfig method found on Kanbn instance`);
    }
    const config = args.config;
    if (config === null || typeof config !== "object" || Array.isArray(config)) {
        throw new Error(`Missing required parameter: config`);
    }
    await instance.saveConfig(config);
    return textResponse(`Config saved successfully`);
};

/**
 * Handle the "kanbn_get_action_rules" MCP tool call: return the board's resolved action rules.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnGetActionRules: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args);
    const index = await getBoardIndex(instance);
    const rules = await instance.getActionRules(index);
    return jsonResponse(rules);
};

/**
 * Handle the "kanbn_find_action_warnings" MCP tool call: return potential issues with the action rules.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnFindActionWarnings: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args);
    const warnings = await instance.findActionWarnings();
    return jsonResponse(warnings);
};

/**
 * Handle the "kanbn_get_date_format" MCP tool call: return the board's date format string.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnGetDateFormat: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args);
    const index = await getBoardIndex(instance);
    return textResponse(instance.getDateFormat(index));
};

/**
 * Handle the "kanbn_get_task_template" MCP tool call: return the board's task template string.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnGetTaskTemplate: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args);
    const index = await getBoardIndex(instance);
    return textResponse(instance.getTaskTemplate(index));
};

/**
 * Handle the "kanbn_get_workspace_options" MCP tool call: return workspace-scoped options.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnGetWorkspaceOptions: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args, false);
    const options = await instance.getWorkspaceOptions();
    return jsonResponse(options);
};

/**
 * Handle the "kanbn_validate_board" MCP tool call: validate the board, returning true or parsing errors.
 * @param {Record<string, any>} args MCP tool arguments
 * @returns {Promise<McpResponse>} The MCP content response
 */
export const handleKanbnValidateBoard: ToolHandler = async (args) => {
    const { instance } = await readyBoard(args);
    const save = args.save === true;
    const result = await instance.validate(save);
    const text = result === true ? "Board is valid" : JSON.stringify(result, null, 2);
    return textResponse(text);
};

export const configTools: ToolDefinition[] = [
    defineTool(
        "kanbn_get_config",
        "Get the Kanbn config, or null if no separate config file exists.",
        handleKanbnGetConfig,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_save_config",
        "Save the Kanbn config to a config file.",
        handleKanbnSaveConfig,
        {
            path: PATH_PROPERTY,
            config: { type: "object", description: "Kanbn config object to persist" },
        },
        ["config"],
    ),
    defineTool(
        "kanbn_get_action_rules",
        "Get the resolved action rules for the board.",
        handleKanbnGetActionRules,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_find_action_warnings",
        "Get potential issues with the board's action rules.",
        handleKanbnFindActionWarnings,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_get_date_format",
        "Get the board's date format string.",
        handleKanbnGetDateFormat,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_get_task_template",
        "Get the board's task template string.",
        handleKanbnGetTaskTemplate,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_get_workspace_options",
        "Get workspace-scoped Kanbn options.",
        handleKanbnGetWorkspaceOptions,
        {
            path: PATH_PROPERTY,
        },
    ),
    defineTool(
        "kanbn_validate_board",
        "Validate the board and return true or a list of parsing errors.",
        handleKanbnValidateBoard,
        {
            path: PATH_PROPERTY,
            save: { type: "boolean", description: "Re-save files while validating (default: false)" },
        },
    ),
];