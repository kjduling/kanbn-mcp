import type { McpResponse } from "./kanbn/response.js";

/**
 * An MCP tool call handler: validates the arguments and produces an MCP content response.
 */
export type ToolHandler = (args: Record<string, any>) => Promise<McpResponse>;

/**
 * A declarative MCP tool: schema plus the handler that implements it.
 * The registry flattens these into the TOOLS list and the dispatch map.
 */
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
    handler: ToolHandler;
}

/**
 * Build a tool definition from named parts.
 * @param {string} name The MCP tool name
 * @param {string} description The tool description
 * @param {ToolHandler} handler The tool implementation
 * @param {Record<string, any>} properties The input schema properties
 * @param {string[]} [required] Required property names
 * @returns {ToolDefinition} The tool definition
 */
export function defineTool(
    name: string,
    description: string,
    handler: ToolHandler,
    properties: Record<string, any>,
    required?: string[],
): ToolDefinition {
    const inputSchema: Record<string, any> = { type: "object", properties };
    if (required && required.length > 0) {
        inputSchema.required = required;
    }
    return { name, description, inputSchema, handler };
}

/**
 * Build an alias tool definition that reuses another definition's schema and handler.
 * @param {ToolDefinition} base The canonical tool definition
 * @param {string} name The alias tool name
 * @param {string} description The alias description
 * @returns {ToolDefinition} The alias definition
 */
export function aliasTool(base: ToolDefinition, name: string, description: string): ToolDefinition {
    return { name, description, inputSchema: base.inputSchema, handler: base.handler };
}