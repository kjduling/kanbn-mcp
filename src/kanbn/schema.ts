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

export const RELATION_ITEM_SCHEMA = {
    type: "object",
    properties: {
        task: { type: "string", description: "Target task ID the relation points to" },
        type: { type: "string", description: "Relation type, e.g. 'depends-on' or 'blocks' (normalised to kebab-case)" },
    },
};

export const RELATIONS_PROPERTY = {
    type: "array",
    items: RELATION_ITEM_SCHEMA,
    description: "Task relations: an array of {task, type} edges (e.g. {task: 'model', type: 'depends-on'}). WARNING: on edit this replaces the WHOLE relations collection — supply the full array, or use kanbn_add_relation / kanbn_remove_relation for merges.",
};