declare module "@basementuniverse/kanbn" {
    export function initialise(options?: Record<string, any>): Promise<any>;
    export function getIndex(): Promise<any>;
    export function getTask(taskId: string): Promise<any>;
    export function createTask(taskData: Record<string, any>, column: string): Promise<string>;
    export function moveTask(taskId: string, column: string): Promise<void>;
    export function editTask(taskId: string, taskData: Record<string, any>): Promise<void>;
    export function deleteTask(taskId: string, force?: boolean): Promise<void>;
    export function archiveTask(taskId: string): Promise<void>;
}