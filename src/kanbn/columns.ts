import { getBoardIndex } from "./instance.js";

/**
 * Resolve a requested column name against the board's actual column names.
 *
 * An exact (trimmed) match wins; otherwise a case-insensitive match is used, so callers can type
 * "TODO" or "in progress" when the index stores "Todo" / "In Progress". Returns null when there is
 * no match, or when the case-insensitive match is ambiguous.
 * @param {string[]} columnNames The board's canonical column names
 * @param {string} requested The column name the caller asked for
 * @returns {string | null} The canonical column name, or null when it cannot be resolved
 */
export function matchColumnName(columnNames: string[], requested: string): string | null {
    if (typeof requested !== "string") {
        return null;
    }
    const trimmed = requested.trim();
    if (trimmed.length === 0) {
        return null;
    }
    if (columnNames.includes(trimmed)) {
        return trimmed;
    }
    const lower = trimmed.toLowerCase();
    const matches = columnNames.filter((name) => name.toLowerCase() === lower);
    return matches.length === 1 ? matches[0] : null;
}

/**
 * Read the board's canonical column names from its index.
 * @param {any} instance A Kanbn instance
 * @returns {Promise<string[]>} The column names, or an empty array when the index has none
 */
export async function getColumnNames(instance: any): Promise<string[]> {
    const index = await getBoardIndex(instance);
    const columns = index?.columns;
    if (Array.isArray(columns)) {
        return columns
            .map((column: any) => (typeof column === "string" ? column : (column?.name ?? column?.id)))
            .filter((name: any): name is string => typeof name === "string");
    }
    if (columns && typeof columns === "object") {
        return Object.keys(columns);
    }
    return [];
}

/**
 * Resolve a requested column name to the board's canonical name, throwing a clear error listing the
 * valid columns when it cannot be matched.
 * @param {any} instance A Kanbn instance
 * @param {string} requested The column name the caller asked for
 * @returns {Promise<string>} The canonical column name
 * @throws {Error} When no board column matches the requested name
 */
export async function resolveColumnName(instance: any, requested: string): Promise<string> {
    const columnNames = await getColumnNames(instance);
    const match = matchColumnName(columnNames, requested);
    if (match) {
        return match;
    }
    const valid = columnNames.length
        ? columnNames.map((name) => `"${name}"`).join(", ")
        : "(none - no board found)";
    throw new Error(`Column "${requested}" doesn't exist. Valid columns: ${valid}`);
}
