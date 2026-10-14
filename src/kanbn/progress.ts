/**
 * Progress is a derived property of a task: how much of its work is complete.
 *
 * The tools recompute it on every create, edit and move so the field can never drift from reality:
 * - a task with sub-tasks is complete to the fraction of sub-tasks ticked;
 * - a task with no sub-tasks is incomplete (0) until it sits in a completed column, then complete (1).
 *
 * Progress is board-agnostic (it lives in the task's metadata), but "is this column a completed
 * column?" comes from the board index, which is why callers pass that flag in.
 */

/** How many decimal places a derived progress value is stored to. */
export const PROGRESS_DECIMALS = 2;

/**
 * Round a 0..1 progress value to a stable number of decimals so 1/3 doesn't store a long tail.
 * @param {number} value The raw fraction
 * @returns {number} The rounded fraction
 */
export function roundProgress(value: number): number {
    const factor = 10 ** PROGRESS_DECIMALS;
    return Math.round(value * factor) / factor;
}

/**
 * Derive a task's progress from its sub-tasks and whether it sits in a completed column.
 * @param {any} subTasks The task's sub-tasks (array), or anything falsy/absent
 * @param {boolean} inCompletedColumn Whether the task's column is a completed column
 * @returns {number} Progress between 0 and 1
 */
export function deriveProgress(subTasks: any, inCompletedColumn: boolean): number {
    if (Array.isArray(subTasks) && subTasks.length > 0) {
        const completed = subTasks.filter((subTask) => subTask && subTask.completed === true).length;
        return roundProgress(completed / subTasks.length);
    }
    return inCompletedColumn ? 1 : 0;
}

/**
 * Read the board index's completed columns, defaulting to none.
 * @param {any} index A board index
 * @returns {string[]} The completed column names
 */
export function getCompletedColumns(index: any): string[] {
    const columns = index?.options?.completedColumns;
    return Array.isArray(columns) ? columns : [];
}

/**
 * Whether a column name is one of the board's completed columns.
 * @param {any} index A board index
 * @param {string | null | undefined} column The column name
 * @returns {boolean} True when the column is a completed column
 */
export function isCompletedColumn(index: any, column: string | null | undefined): boolean {
    return Boolean(column) && getCompletedColumns(index).includes(column as string);
}

/**
 * Apply the derived progress to task data in place.
 * @param {Record<string, any>} taskData Task data being built for a write
 * @param {boolean} inCompletedColumn Whether the task's column is a completed column
 * @returns {number} The progress value written
 */
export function applyDerivedProgress(taskData: Record<string, any>, inCompletedColumn: boolean): number {
    const progress = deriveProgress(taskData.subTasks, inCompletedColumn);
    if (!taskData.metadata || typeof taskData.metadata !== "object") {
        taskData.metadata = {};
    }
    taskData.metadata.progress = progress;
    return progress;
}

/**
 * Build a warning for parking incomplete work in a completed column, or null when there is nothing
 * to warn about.
 * @param {string} taskId The task id
 * @param {number} progress The derived progress
 * @param {any} subTasks The task's sub-tasks
 * @returns {string | null} The warning line, or null
 */
export function progressWarning(taskId: string, progress: number, subTasks: any): string | null {
    if (progress >= 1) {
        return null;
    }
    const percent = Math.round(progress * 100);
    if (Array.isArray(subTasks) && subTasks.length > 0) {
        const completed = subTasks.filter((subTask) => subTask && subTask.completed === true).length;
        return `Warning: task "${taskId}" is ${percent}% complete (${completed}/${subTasks.length} sub-tasks) - parking incomplete work in a completed column.`;
    }
    return `Warning: task "${taskId}" is ${percent}% complete yet is sitting in a completed column.`;
}

/**
 * Build a note for when a caller explicitly supplied a progress that the derived value replaced, so
 * the recomputation is never silent.
 * @param {any} supplied The caller-supplied progress value, if any
 * @param {number} derived The derived progress that was actually stored
 * @returns {string | null} The note line, or null when there is nothing to report
 */
export function progressOverrideNote(supplied: any, derived: number): string | null {
    if (typeof supplied === "number" && supplied !== derived) {
        return `Note: progress is derived from the work, not typed; the supplied value (${supplied}) was replaced by ${derived}.`;
    }
    return null;
}
