/**
 * Shared types for the `kanbn-mcp setup` command.
 */

export interface SetupColumn {
    /** Column name exactly as configured on the board. */
    name: string;
    /** One-line meaning shown to agents. */
    meaning: string;
}

export interface SetupTagVocab {
    /** Tag value (e.g. "bug"). */
    name: string;
    /** One-line description shown to agents. */
    description: string;
}

export type TagStyle = "prefixed" | "plain";

export interface SetupCustomField {
    name: string;
    type: string;
    required: boolean;
}

/**
 * Everything `kanbn-mcp setup` collects. Every field has a sensible default so
 * a non-interactive run (`--yes`) always produces coherent guidance.
 */
export interface SetupAnswers {
    /** Board root directory (the one containing .kanbn). */
    boardRoot: string;
    /** Human-readable project name shown in the guidance heading. */
    projectName: string;
    columns: SetupColumn[];
    typeTags: SetupTagVocab[];
    priorityTags: SetupTagVocab[];
    /** prefixed = typ:bug / pri:critical; plain = bug / critical. */
    tagStyle: TagStyle;
    /** Whether agents must file every ticket with its type+priority tags. */
    enforceTags: boolean;
    /** Column name -> WIP limit. Absent/0 columns have no limit. */
    wipLimits: Record<string, number>;
    customFields: SetupCustomField[];
    /** Whether relation edges should be created in both directions. */
    mirrorRelations: boolean;
}

export type HostSlug = "opencode" | "claude" | "windsurf" | "cline" | "devin" | "copilot";

export interface WrittenTarget {
    path: string;
    host: string;
    kind: "block" | "file";
    /** Whether this run's write changed the file on disk (plans: always true). */
    changed: boolean;
}

export interface RegisteredTarget {
    path: string;
    client: string;
    message: string;
}

export interface SetupManifest {
    schemaVersion: number;
    generatedAt: string;
    answers: SetupAnswers;
    written: WrittenTarget[];
    registered: RegisteredTarget[];
}