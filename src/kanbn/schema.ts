/**
 * Shared MCP tool input schema fragments, so every tool schema describes the
 * common fields (path, sub-tasks, comments) in exactly the same way.
 */

export const PATH_PROPERTY = { type: "string", description: "Path to the project root directory" };

export const SUBTASK_ITEM_SCHEMA = {
    type: "object",
    properties: {
        text: { type: "string", description: "Sub-task text (primary field)" },
        name: { type: "string", description: "Deprecated alias for text; ignored when text is set" },
        description: { type: "string", description: "Deprecated alias for text; ignored when text or name is set" },
        completed: { type: "boolean", description: "Whether the sub-task is completed" },
    },
};

export const SUBTASKS_PROPERTY = {
    type: "array",
    items: SUBTASK_ITEM_SCHEMA,
};

export const COMMENT_ITEM_SCHEMA = {
    type: "object",
    properties: {
        author: { type: "string", description: "Comment author" },
        date: { type: "string", description: "Comment date (ISO string)" },
        text: { type: "string", description: "Comment text" },
    },
};

export const COMMENTS_PROPERTY = {
    type: "array",
    items: COMMENT_ITEM_SCHEMA,
};