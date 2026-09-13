/**
 * Argument validation helpers for MCP tool call handlers.
 */

/**
 * Read a required string argument, throwing a clear validation error when it is
 * missing, not a string, or empty.
 * @param {Record<string, any>} args The tool call arguments
 * @param {string} name The argument name
 * @returns {string} The validated argument value
 */
export function getRequiredString(args: Record<string, any>, name: string): string {
    const value = args[name];
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Missing required parameter: ${name}`);
    }
    return value;
}