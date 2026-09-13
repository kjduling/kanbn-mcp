/**
 * Shared MCP response helpers and output size limits.
 */

export const DEFAULT_MAX_RESPONSE_SIZE = 100 * 1024;
export const TRUNCATED_RESPONSE_MARKER = "[kanbn_status response truncated: exceeds size limit]";

/**
 * Get the maximum response size (in bytes) for JSON output, from the KANBN_MAX_RESPONSE_SIZE
 * environment variable, or the default of 100KB when unset or invalid.
 * @return {number} The maximum response size in bytes
 */
export function getMaxResponseSize(): number {
    const parsed = parseInt(process.env.KANBN_MAX_RESPONSE_SIZE ?? "", 10);
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
    }
    return DEFAULT_MAX_RESPONSE_SIZE;
}

/**
 * Truncate a string to a maximum byte size, appending a marker that indicates the response was truncated.
 * The cut is made at a character boundary so multi-byte characters are never split.
 * @param {string} text The text to truncate
 * @param {number} maxBytes The maximum byte size
 * @return {string} The truncated text with the truncation marker appended
 */
export function truncateResponse(text: string, maxBytes: number): string {
    const markerBytes = Buffer.byteLength(TRUNCATED_RESPONSE_MARKER);
    const budget = maxBytes - markerBytes;
    if (budget <= 0) {
        return TRUNCATED_RESPONSE_MARKER;
    }
    let low = 0;
    let high = text.length;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (Buffer.byteLength(text.slice(0, mid)) <= budget) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return text.slice(0, low) + TRUNCATED_RESPONSE_MARKER;
}

export interface McpContentBlock {
    type: string;
    text: string;
}

export interface McpResponse {
    content: McpContentBlock[];
}

/**
 * Build an MCP content response from a text string.
 * @param {string} text The response text
 * @returns {McpResponse} The MCP content response
 */
export function textResponse(text: string): McpResponse {
    return {
        content: [{ type: "text", text }],
    };
}

/**
 * Build an MCP content response by serializing a value as JSON.
 * @param {unknown} data The value to serialize
 * @param {number} [spaces=2] Indentation spaces for the serialized output
 * @returns {McpResponse} The MCP content response
 */
export function jsonResponse(data: unknown, spaces: number = 2): McpResponse {
    return textResponse(JSON.stringify(data, null, spaces));
}

/**
 * Wrap a thrown error in a new error carrying an operation prefix, preserving its message.
 * @param {string} prefix The prefix to prepend (e.g. "Failed to list archived tasks")
 * @param {unknown} error The error that was thrown
 * @returns {never} Always throws
 */
export function rethrowOperationError(prefix: string, error: unknown): never {
    throw new Error(`${prefix}: ${(error as Error).message}`);
}