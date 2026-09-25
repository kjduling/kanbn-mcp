/**
 * The canonical, client-neutral AI guidance body for a Kanbn board.
 *
 * Everything `kanbn-mcp setup` writes (AGENTS.md block, SKILL.md, CLAUDE.md,
 * rule files) is generated from the single body this module produces. The
 * prose must never mention a specific AI client, host, or client-specific
 * syntax - only kanbn-mcp MCP tool names and board concepts.
 */

import { SetupAnswers, SetupColumn, SetupTagVocab } from "./types.js";

/** Where the generic (repo-shipped) skill body shows the board root. */
export const PLACEHOLDER_BOARD_ROOT = "the project root containing the .kanbn directory";

/** Where the generic (repo-shipped) skill body shows the project name. */
export const PLACEHOLDER_PROJECT_NAME = "Kanbn";

export interface RenderOptions {
    /**
     * When true, substitute the real board root / project name with generic
     * placeholders so the shipped SKILL.md stays valid for any consumer.
     */
    placeholder?: boolean;
}

function renderColumns(columns: SetupColumn[]): string {
    return columns
        .map((c) => `- ${c.name} — ${c.meaning}`)
        .join("\n");
}

function tagValue(style: "prefixed" | "plain", family: "typ" | "pri", name: string): string {
    return style === "prefixed" ? `${family}:${name}` : name;
}

function renderTagList(style: "prefixed" | "plain", tags: SetupTagVocab[]): string {
    return tags
        .map((t) => `- ${tagValue(style, "typ", t.name)} — ${t.description}`)
        .join("\n");
}

function renderPriorityList(style: "prefixed" | "plain", tags: SetupTagVocab[]): string {
    return tags
        .map((t) => `- ${tagValue(style, "pri", t.name)} — ${t.description}`)
        .join("\n");
}

function renderWipLimits(limits: Record<string, number>): string {
    const active = Object.entries(limits).filter(([, limit]) => limit > 0);
    if (active.length === 0) {
        return "";
    }
    const lines = active.map(([column, limit]) => `- ${column}: at most ${limit} in-flight`).join("\n");
    return `
## WIP limits

Keep at most these many tasks in flight per column; hold new work in the
column before the limit's column until a seat opens:

${lines}
`;
}

function renderCustomFields(fields: SetupAnswers["customFields"]): string {
    if (fields.length === 0) {
        return "";
    }
    const lines = fields
        .map((f) => `- ${f.name}: ${f.type}${f.required ? " (required)" : ""}`)
        .join("\n");
    return `
## Custom fields

Set these fields on tasks via the "metadata" argument of
kanbn_create_task / kanbn_edit_task:

${lines}
`;
}

/**
 * Render the canonical client-neutral guidance body from the answers.
 * @param answers The collected setup answers
 * @param options Render options
 * @returns The markdown body (no client names, no client syntax)
 */
export function renderCanonical(answers: SetupAnswers, options: RenderOptions = {}): string {
    const boardRoot = options.placeholder ? PLACEHOLDER_BOARD_ROOT : answers.boardRoot;
    const projectName = options.placeholder ? PLACEHOLDER_PROJECT_NAME : answers.projectName;
    const style = answers.tagStyle;

    const typeTags = renderTagList(style, answers.typeTags);
    const priorityTags = renderPriorityList(style, answers.priorityTags);

    const typeVals = answers.typeTags.map((t) => tagValue(style, "typ", t.name)).join(", ");
    const priorityVals = answers.priorityTags.map((t) => tagValue(style, "pri", t.name)).join(", ");

    const enforcePhrase = answers.enforceTags
        ? "This vocabulary is enforced: do not file a ticket until its type and priority tags are set."
        : "When unsure which tag is closest, prefer the best match and ask the board owner rather than inventing a new tag.";

    const mirrorPhrase = answers.mirrorRelations
        ? "Create BOTH ends of a directed pair when the relationship is mutual: A depends-on B implies B blocks A; X duplicate-of Y implies Y duplicated-by X."
        : "Relations on this board are recorded in one direction only; if a pair needs both ends, say so explicitly.";

    const wipSection = renderWipLimits(answers.wipLimits);
    const customFieldsSection = renderCustomFields(answers.customFields);

    return `# Kanbn board guidance

This board is worked through the kanbn-mcp MCP tools (kanbn_create_task,
kanbn_edit_task, kanbn_get_task, kanbn_move_task, kanbn_add_relation,
kanbn_search, ...). Follow the conventions below for every interaction.

## Board and columns

Project: ${projectName}
Board root: ${boardRoot}

Columns (do not move a task to a column not listed here):

${renderColumns(answers.columns)}

## Tags - classify every ticket

Every ticket carries two tags: one type and one priority.

Type (exactly one: ${typeVals}):

${typeTags}

Priority (${priorityVals}):

${priorityTags}

${enforcePhrase} Reuse existing tags; never invent a new family or format.

## Filing tickets

Create tickets with kanbn_create_task. Always:

- set the ticket's type and priority tags at creation
- put the breakdown in the subTasks array, never as bullet lists in description:
  - the work items
  - acceptance test items ("verify that ...")
  - unit test requirements ("add a test for ...")
- set assigned, due, started, and progress whenever you know them

Bullets in description are invisible to the board: they don't render, aren't
tracked, and don't count in kanbn_search.

## Relations - link tickets

Wire tickets with relations:

- A depends-on B  =>  also add B blocks A
- X duplicate-of Y  =>  also add Y duplicated-by X
- related-to is symmetric - record it once on either ticket

${mirrorPhrase}

Prefer kanbn_add_relation for edges. kanbn_edit_task and kanbn_set_relations
replace the whole relations array, so read the current task first
(kanbn_get_task) before re-supplying relations.

## Verify after every create/edit

Follow kanbn_create_task or kanbn_edit_task with kanbn_get_task (or
kanbn_status) and confirm name, tags, subTasks, relations, and column.
Stale or abbreviated arguments silently drop data.${wipSection}${customFieldsSection}
`;
}

/** Frontmatter for the SKILL.md envelope (opencode + other skill readers). */
export const SKILL_FRONTMATTER = `---
name: kanbn
description: Work with a Kanbn board through the kanbn-mcp tools - file, edit, move, and track tickets using the board's tag vocabulary, sub-task structure, and bidirectional relation links. Use when planning, filing, editing, moving, or searching tickets on a Kanbn board.
version: 1
---`;

/**
 * Render the full SKILL.md envelope: frontmatter + canonical body + managed
 * marker so setups can regenerate or remove it safely.
 * @param answers The collected setup answers
 * @param options Render options
 * @returns The complete SKILL.md file content
 */
export function renderSkill(answers: SetupAnswers, options: RenderOptions = {}): string {
    const body = renderCanonical(answers, options);
    const marker = "<!-- generated by kanbn-mcp setup; re-run `kanbn-mcp setup` to regenerate, `kanbn-mcp uninstall` to remove -->";
    return `${SKILL_FRONTMATTER}\n\n${body.trim()}\n\n${marker}\n`;
}