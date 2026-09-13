declare module "@basementuniverse/kanbn" {
    export class Kanbn {
        /**
         * `actions` is deliberately wider than the boolean the constructor's runtime only special-cases
         * (`options.actions === false`). Strings and objects are accepted and pass through untouched,
         * e.g. as workspace/board action rules (`actionsFile`-style config), so a bare `boolean`
         * would reject valid values.
         * @param {any} [root=null] The workspace root folder
         * @param {{ board?: string, caches?: any, actions?: boolean | string | Record<string, any> }} [options={}] Instance options
         * TODO: re-sync this with the library's own types (`@basementuniverse/kanbn/src/main.d.ts`)
         * when it ships richer constructor options typing.
         */
        constructor(root?: any, options?: { board?: string, caches?: any, actions?: boolean | string | Record<string, any> });
        initialised(): Promise<boolean>;
        getIndex(): Promise<any>;
        getTask(taskId: string): Promise<any>;
        createTask(taskData: Record<string, any>, column: string): Promise<string>;
        moveTask(taskId: string, column: string): Promise<void>;
        editTask(taskId: string, taskData: Record<string, any>): Promise<void>;
        deleteTask(taskId: string, force?: boolean): Promise<void>;
        archiveTask(taskId: string): Promise<void>;
    }

    export function initialise(options?: Record<string, any>): Promise<any>;
    export function getIndex(): Promise<any>;
    export function getTask(taskId: string): Promise<any>;
    export function createTask(taskData: Record<string, any>, column: string): Promise<string>;
    export function moveTask(taskId: string, column: string): Promise<void>;
    export function editTask(taskId: string, taskData: Record<string, any>): Promise<void>;
    export function deleteTask(taskId: string, force?: boolean): Promise<void>;
    export function archiveTask(taskId: string): Promise<void>;
}