import path from "node:path";

/**
 * Create a Kanbn board instance for a directory.
 * @param {string} boardPath Path to the project root directory (must contain a .kanbn folder)
 * @returns {any} A Kanbn instance, or undefined if boards are not supported
 */
export function getKanbnInstance(boardPath: string): any {
    let mod: any;
    try {
        mod = require("@basementuniverse/kanbn/src/main.js");
    } catch {
        try {
            mod = require("@basementuniverse/kanbn");
        } catch {
            return null;
        }
    }

    const Kanbn = mod?.Kanbn || mod?.default?.Kanbn || (typeof mod === "function" ? mod : mod?.default);
    if (typeof Kanbn === "function") {
        return new Kanbn(boardPath);
    }
    return null;
}

/**
 * Resolve the board path from an explicit override, the KANBN_DEFAULT_PATH
 * environment variable, or the server working directory.
 * @param {string} [customPath] Optional explicit board path
 * @returns {string} The resolved absolute board path
 */
export function getKanbnPath(customPath?: string): string {
    if (customPath) {
        return path.resolve(customPath);
    }
    if (process.env.KANBN_DEFAULT_PATH) {
        return path.resolve(process.env.KANBN_DEFAULT_PATH);
    }
    return process.cwd();
}

/**
 * Resolve the index-loading method on a Kanbn instance, or undefined when none is available.
 * @param {any} instance A Kanbn instance
 * @returns {((...args: any[]) => any) | undefined} The index method, if present
 */
export function getIndexMethod(instance: any): ((...args: any[]) => any) | undefined {
    const fn = instance.getIndex || instance.index || instance.loadIndex;
    return typeof fn === "function" ? fn : undefined;
}

/**
 * Load the board index from a Kanbn instance, or an empty object if the instance has no loader.
 * @param {any} instance A Kanbn instance
 * @returns {Promise<any>} The parsed index object
 */
export async function getBoardIndex(instance: any): Promise<any> {
    const getIndexFn = getIndexMethod(instance);
    if (typeof getIndexFn !== "function") {
        return {};
    }
    try {
        return await getIndexFn.call(instance);
    } catch (error) {
        throw new Error(`Failed to load board index: ${(error as Error).message}`);
    }
}

export const KNOWN_INITIALIZED_METHODS: readonly string[] = [
    "initialised",
    "initialized",
    "isInitialized",
    "isInitialised",
];

const customInitializedMethods = new Set<string>();

/**
 * Register an additional method name that isBoardInitialized should treat as a board-initialised check.
 * @param {string} methodName Method name on the Kanbn instance
 * @returns {void}
 */
export function registerInitializedMethod(methodName: string): void {
    customInitializedMethods.add(methodName);
}

/**
 * Check whether the board at boardPath is already initialized.
 *
 * Detection order: known method names (initialised, initialized, isInitialized,
 * isInitialised) plus any registered custom names, then any function property that
 * looks like an initialised check (name ends in "initialized"/"initialised").
 * Writes a console.warn when nothing matches, instead of silently returning false.
 *
 * @param {any} instance A Kanbn instance
 * @param {string} boardPath Path to the project root directory
 * @returns {Promise<boolean>} True when the board is initialized
 */
export async function isBoardInitialized(instance: any, boardPath: string): Promise<boolean> {
    if (!instance) return false;

    const candidates = Array.from(new Set([
        ...KNOWN_INITIALIZED_METHODS,
        ...customInitializedMethods,
    ]));

    let fn: unknown = null;
    for (const name of candidates) {
        if (typeof instance[name] === "function") {
            fn = instance[name];
            break;
        }
    }

    // Fallback: any function property that looks like a board-initialised check.
    // Looks for names ending in "initialized" or "initialised", which deliberately
    // excludes the initialize/initialise setup methods.
    if (fn === null) {
        try {
            const lookalike = Object.keys(instance).find(
                (key) =>
                    typeof instance[key] === "function" &&
                    /initiali[sz]ed$/i.test(key)
            );
            if (lookalike) {
                fn = instance[lookalike];
            }
        } catch { }
    }

    if (fn === null) {
        console.warn(
            `[isBoardInitialized] No recognized initialised-check method found on Kanbn instance for: ${boardPath} (tried: ${candidates.join(", ")})`
        );
        return false;
    }

    const checkFn = fn as (...args: any[]) => Promise<boolean> | boolean;
    try {
        return await checkFn.call(instance);
    } catch {
        try {
            return await checkFn.call(instance, boardPath);
        } catch { }
    }
    return false;
}

/**
 * Resolve the Kanbn path and instance for a tool call, throwing when instantiation or initialisation
 * fails. Skips the initialisation check when only the path argument is needed.
 * @param {Record<string, any>} args MCP tool arguments
 * @param {boolean} [requireBoard=true] Also require an initialised board
 * @return {Promise<{instance: any, boardPath: string}>} The Kanbn instance and resolved board path
 */
export async function readyBoard(args: Record<string, any>, requireBoard = true): Promise<{ instance: any; boardPath: string; }> {
    const boardPath = getKanbnPath(args.path as string | undefined);
    const instance = getKanbnInstance(boardPath);
    if (!instance) {
        throw new Error(`Failed to instantiate Kanbn at ${boardPath}`);
    }
    if (requireBoard && !(await isBoardInitialized(instance, boardPath))) {
        throw new Error(`No Kanbn board found at: ${boardPath}`);
    }
    return { instance, boardPath };
}