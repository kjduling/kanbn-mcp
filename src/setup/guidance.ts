/**
 * The canonical, client-neutral AI guidance body for a Kanbn board.
 *
 * Everything `kanbn-mcp setup` writes (AGENTS.md block, SKILL.md, CLAUDE.md,
 * rule files) is generated from the single body this module produces. The
 * prose must never mention a specific AI client, host, or client-specific
 * syntax - only kanbn-mcp MCP tool names and board concepts.
 *
 * Two bodies exist:
 * - the PROJECT body (renderCanonical): board conventions (columns, tags,
 *   WIP limits, custom fields, mirroring) plus tool mechanics. It is written
 *   inside the project it describes and always carries that board's answers.
 * - the GLOBAL body (renderGlobalCanonical): tool mechanics ONLY. Global
 *   skills are per-user and shared by every project, so they must never
 *   carry any one board's name, root, columns, or tag vocabulary - that
 *   would bake one project's conventions into every other project's
 *   context. Instead it points the agent at the project's own guidance.
 */

import { SetupAnswers, SetupTagVocab } from "./types.js";

/** Where the generic (repo-shipped) skill body shows the board root. */
export const PLACEHOLDER_BOARD_ROOT = "the project root containing the .kanbn directory";

/** Where the generic (repo-shipped) skill body shows the project name. */
export const PLACEHOLDER_PROJECT_NAME = "Kanbn";

function renderColumns(columns: SetupAnswers["columns"]): string {
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

// Board-neutral sections, shared verbatim by the project body and the global
// body. They live here so the two renderers cannot drift apart.

const FILING_SECTION = `## Filing tickets

Create tickets with kanbn_create_task. Always:

- set the ticket's type and priority tags at creation
- put the breakdown in the subTasks array, never as bullet lists in description:
  - the work items
  - acceptance test items ("verify that ...")
  - unit test requirements ("add a test for ...")
- set assigned, due, started, and progress whenever you know them

Sub-tasks replace as a whole collection. To tick one off (or reopen it), resend
the FULL subTasks array - every entry with its "text" and its "completed" flag.
An entry with no text is rejected, because it would blank the sub-task it
replaced.

Bullets in description are invisible to the board: they don't render, aren't
tracked, and don't count in kanbn_search.

A description must not contain an unfenced level-2 heading that names a
reserved section - "## Metadata", "## Sub-tasks", "## Relations", "## Comments"
or "## History". Kanbn treats such a heading as the real section wherever it
appears, silently truncating the description and re-parsing what follows. The
write is rejected; show a heading like that demoted ("### Sub-tasks") or inside
a fenced code block instead.`;

const RELATIONS_BULLETS = `- A depends-on B  =>  also add B blocks A
- X duplicate-of Y  =>  also add Y duplicated-by X
- related-to is symmetric - record it once on either ticket`;

const RELATIONS_FOOTER = `Prefer kanbn_add_relation for edges. kanbn_edit_task and kanbn_set_relations
replace the whole relations array, so read the current task first
(kanbn_get_task) before re-supplying relations.`;

const PROGRESS_SECTION = `## Progress and completion

Progress is derived from the work, not typed in: a ticket with sub-tasks is
complete to the fraction of sub-tasks ticked, and a ticket with no sub-tasks is
0% while open and 100% once it sits in a completed column. The tools recompute
it on every create, edit and move, so never set it by hand.

A ticket is only Done when it is genuinely finished: progress is 100% AND its
tests pass. Moving an incomplete ticket into a completed column still goes
through but now reports a warning - treat that warning as a stop sign, not a
formality, and move the ticket back out until the work (and its tests) are
complete.`;

const VERIFY_SECTION = `## Verify after every create/edit

Follow kanbn_create_task or kanbn_edit_task with kanbn_get_task (or
kanbn_status) and confirm name, tags, subTasks, relations, and column.
Stale or abbreviated arguments silently drop data.`;

/**
 * Render the canonical client-neutral guidance body from the answers.
 * @param answers The collected setup answers
 * @returns The markdown body (no client names, no client syntax)
 */
export function renderCanonical(answers: SetupAnswers): string {
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

Project: ${answers.projectName}
Board root: ${answers.boardRoot}

Columns (do not move a task to a column not listed here):

${renderColumns(answers.columns)}

## Tags - classify every ticket

Every ticket carries two tags: one type and one priority.

Type (exactly one: ${typeVals}):

${typeTags}

Priority (${priorityVals}):

${priorityTags}

${enforcePhrase} Reuse existing tags; never invent a new family or format.

${FILING_SECTION}

## Relations - link tickets

Wire tickets with relations:

${RELATIONS_BULLETS}

${mirrorPhrase}

${RELATIONS_FOOTER}

${PROGRESS_SECTION}

${VERIFY_SECTION}${wipSection}${customFieldsSection}
`;
}

/**
 * Render the board-neutral body for GLOBAL (per-user) skills.
 *
 * Takes no answers at all - that is the point. Tool mechanics are universal;
 * every board convention (columns, tag vocabulary, WIP limits, custom fields,
 * relation mirroring, project name, board root) belongs to the project that
 * defines it, and the agent is pointed at the project's own guidance for it.
 * @returns The markdown body (no client names, no client syntax, no board data)
 */
export function renderGlobalCanonical(): string {
    return `# Kanbn board guidance

Kanbn boards are worked through the kanbn-mcp MCP tools (kanbn_create_task,
kanbn_edit_task, kanbn_get_task, kanbn_move_task, kanbn_add_relation,
kanbn_search, ...). The mechanics below apply to every board; they carry no
board's own conventions on purpose.

## Board conventions live in the project

Columns, the type/priority tag vocabulary, tag style, WIP limits, custom
fields, and relation mirroring are per-project conventions - this global
skill never defines them, because they differ from board to board. Before
filing or moving a ticket, read the project's kanbn guidance: the managed
kanbn block in its AGENTS.md (or CLAUDE.md, or the host's rule file), or its
project SKILL.md - written by \`kanbn-mcp setup\` run inside that project.
When a project defines no vocabulary of its own, reuse the column and tag
names its existing tickets already use (kanbn_status and kanbn_search show
both).

${FILING_SECTION}

## Relations - link tickets

Wire tickets with relations:

${RELATIONS_BULLETS}

Follow the project's guidance on whether both ends of a mirrored pair are
recorded; the bullets above are the both-ends form.

${RELATIONS_FOOTER}

${PROGRESS_SECTION}

${VERIFY_SECTION}
`;
}

/** Frontmatter for the SKILL.md envelope (opencode + other skill readers). */
export const SKILL_FRONTMATTER = `---
name: kanbn
description: Work with a Kanbn board through the kanbn-mcp tools - file, edit, move, and track tickets using the board's tag vocabulary, sub-task structure, and bidirectional relation links. Use when planning, filing, editing, moving, or searching tickets on a Kanbn board.
version: 1
---`;

/** Managed-file marker so setups can regenerate or remove the skill safely. */
const SKILL_MARKER = "<!-- generated by kanbn-mcp setup; re-run `kanbn-mcp setup` to regenerate, `kanbn-mcp uninstall` to remove -->";

function skillEnvelope(body: string): string {
    return `${SKILL_FRONTMATTER}\n\n${body.trim()}\n\n${SKILL_MARKER}\n`;
}

/**
 * Render the full PROJECT SKILL.md: frontmatter + canonical body with the
 * board's own answers + managed marker.
 * @param answers The collected setup answers
 * @returns The complete SKILL.md file content
 */
export function renderSkill(answers: SetupAnswers): string {
    return skillEnvelope(renderCanonical(answers));
}

/**
 * Render the full GLOBAL SKILL.md: frontmatter + board-neutral mechanics +
 * managed marker. Board-independent: the same bytes for every user and
 * project, so it can never leak one board's conventions into another.
 * @returns The complete SKILL.md file content
 */
export function renderGlobalSkill(): string {
    return skillEnvelope(renderGlobalCanonical());
}
