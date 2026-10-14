/**
 * Normalize MCP tool arguments into Kanbn task metadata objects.
 */

/**
 * Recursively convert ISO date strings in a task metadata object into Date values.
 * @param {Record<string, any>} obj Object to convert
 * @returns {Record<string, any>} A new object with dates converted
 */
function convertDatesInObject(obj: Record<string, any>): Record<string, any> {
    const dateKeys = new Set([
        "due",
        "created",
        "updated",
        "started",
        "completed",
        "plannedStart",
        "plannedFinish",
    ]);

    for (const key of Object.keys(obj)) {
        if (dateKeys.has(key) && typeof obj[key] === "string") {
            const parsed = new Date(obj[key]);
            if (!Number.isNaN(parsed.getTime())) {
                obj[key] = parsed;
            }
        }
    }
    return obj;
}

/**
 * Collections that must be preserved across whole-document edits unless the caller explicitly
 * supplied a replacement. Passing one of these replaces that entire collection; omitting it
 * falls back to whatever the task already has.
 */
export const EDIT_COLLECTION_KEYS: readonly string[] = ["relations", "subTasks", "comments", "history"];

/**
 * Merge the portion of an existing task that an edit did not mention into the outgoing task data.
 *
 * This is the middle ground between the library's whole-document updateTask semantics (every
 * collection is an authoritative replace) and callers who expect partial edits. Fields the
 * caller supplied are kept and replace their collection; fields it didn't supply (name,
 * description, metadata keys, and the relations/subTasks/comments collections) are backfilled
 * from the task that already exists, so an edit never silently clobbers data it didn't mention.
 * @param {Record<string, any>} taskData Outgoing task data being built for the edit
 * @param {Record<string, any>} existingTask The task currently on the board
 * @returns {Record<string, any>} taskData, mutated and returned for chaining
 */
export function mergeExistingTaskData(taskData: Record<string, any>, existingTask: Record<string, any>): Record<string, any> {
    if (existingTask && typeof existingTask === "object") {
        if (!taskData.name && existingTask.name) {
            taskData.name = existingTask.name;
        }
        if (!taskData.description && existingTask.description) {
            taskData.description = existingTask.description;
        }
        if (!taskData.metadata) {
            taskData.metadata = {};
        }
        const existingMeta = existingTask.metadata || {};
        for (const key of Object.keys(existingMeta)) {
            if (taskData.metadata[key] === undefined) {
                taskData.metadata[key] = existingMeta[key];
            }
        }
        for (const key of EDIT_COLLECTION_KEYS) {
            if (taskData[key] === undefined && Array.isArray(existingTask[key])) {
                taskData[key] = structuredClone(existingTask[key]);
            }
        }
    }
    return taskData;
}

/**
 * Build a Kanbn task metadata object from MCP tool arguments.
 * @param {Record<string, any>} args Raw MCP tool arguments
 * @returns {Record<string, any>} A normalized Kanbn task metadata object
 */
export function buildTaskDataFromArgs(args: Record<string, any>): Record<string, any> {
    if (!args || typeof args !== "object") {
        return {};
    }

    let source = { ...args };
    if (source.taskData) {
        let nested = source.taskData;
        if (typeof nested === "string") {
            try {
                nested = JSON.parse(nested);
            } catch { }
        }
        if (nested && typeof nested === "object") {
            delete source.taskData;
            source = { ...source, ...nested };
        }
    }

    const taskData: Record<string, any> = {};
    const metadata: Record<string, any> = {};

    const topLevelKeys = new Set([
        "name",
        "description",
        "subTasks",
        "comments",
        "relations",
        "history",
    ]);

    const ignoreKeys = new Set(["path", "column", "targetColumn", "taskId"]);

    if (source.metadata && typeof source.metadata === "object") {
        Object.assign(metadata, structuredClone(source.metadata));
    }

    for (const [key, value] of Object.entries(source)) {
        if (value === undefined || ignoreKeys.has(key) || key === "metadata") {
            continue;
        }

        if (key === "title") {
            // title is a deprecated alias for name; name is canonical and always wins
            if (value && taskData.name === undefined) {
                taskData.name = value;
            }
            continue;
        }

        if (topLevelKeys.has(key)) {
            taskData[key] = value && typeof value === "object" ? structuredClone(value) : value;
        } else {
            metadata[key] = value && typeof value === "object" ? structuredClone(value) : value;
        }
    }

    // Convert date fields in metadata
    convertDatesInObject(metadata);

    if (Object.keys(metadata).length > 0) {
        taskData.metadata = metadata;
    }

    if (Array.isArray(taskData.comments)) {
        taskData.comments = taskData.comments.map((comment: any) => {
            if (comment && typeof comment.date === "string") {
                return { ...comment, date: new Date(comment.date) };
            }
            return comment;
        });
    }

    if (Array.isArray(taskData.history)) {
        taskData.history = taskData.history.map((entry: any) => {
            if (entry && typeof entry.date === "string") {
                return { ...entry, date: new Date(entry.date) };
            }
            return entry;
        });
    }

    if (Array.isArray(taskData.subTasks)) {
        taskData.subTasks = taskData.subTasks.map((sub: any) => {
            if (typeof sub === "string") {
                return { text: sub, completed: false };
            }
            // text is the primary field; name and description are deprecated aliases kept for
            // backwards compatibility. Precedence: text ?? name ?? description.
            return {
                text: String(sub?.text ?? sub?.name ?? sub?.description ?? ""),
                completed: Boolean(sub?.completed),
            };
        });
    }

    return taskData;
}

/**
 * Reject sub-task entries that carry no text.
 *
 * Sub-tasks are replaced as a whole collection, so an entry with a missing text would silently
 * blank the existing sub-task it replaced. buildTaskDataFromArgs normalises a missing text to "",
 * which makes that catastrophic replace look benign; this guard turns the silent blanking into a
 * loud, actionable error before anything is written.
 * @param {Record<string, any>} taskData Task data built by buildTaskDataFromArgs
 * @returns {void}
 * @throws {Error} When any sub-task entry has an empty or whitespace-only text
 */
export function assertSubTasksHaveText(taskData: Record<string, any>): void {
    if (!taskData || !Array.isArray(taskData.subTasks)) {
        return;
    }
    taskData.subTasks.forEach((subTask: any, index: number) => {
        if (!subTask || typeof subTask.text !== "string" || subTask.text.trim() === "") {
            throw new Error(
                `Invalid subTasks entry at index ${index}: "text" is required. ` +
                `Sub-tasks are replaced as a whole collection, so an entry with no text would blank the sub-task it replaced. ` +
                `To change completion, resend the full subTasks array with every entry's "text" and "completed".`
            );
        }
    });
}