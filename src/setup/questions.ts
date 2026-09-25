/**
 * Question set and answer handling for `kanbn-mcp setup`.
 *
 * Every answer has a default, so `--yes` / `--json <file>` runs are fully
 * non-interactive and CI-able. Prompts are Enter-to-accept-default and
 * tolerant of partial answers; re-runs amend from the persisted manifest.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { PLACEHOLDER_BOARD_ROOT, PLACEHOLDER_PROJECT_NAME } from "./guidance.js";
import { SetupAnswers, SetupColumn, SetupCustomField, SetupManifest, SetupTagVocab, TagStyle } from "./types.js";

/** Load setup.json from the board root. */
export function manifestPath(root: string): string {
    return path.join(root, ".kanbn", "setup.json");
}

export function readManifest(root: string): SetupManifest | null {
    try {
        const raw = fs.readFileSync(manifestPath(root), "utf8");
        const parsed = JSON.parse(raw) as SetupManifest;
        if (parsed.schemaVersion !== 1 || !parsed.answers) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function writeManifest(root: string, manifest: SetupManifest): void {
    fs.mkdirSync(path.dirname(manifestPath(root)), { recursive: true });
    fs.writeFileSync(manifestPath(root), JSON.stringify(manifest, null, 2) + "\n");
}

export function defaultAnswers(boardRoot: string): SetupAnswers {
    return {
        boardRoot: path.resolve(boardRoot),
        projectName: path.basename(path.resolve(boardRoot)) || "Kanbn",
        columns: [
            { name: "Backlog", meaning: "queued but not started" },
            { name: "Todo", meaning: "up next, defined and ready to pick up" },
            { name: "In Progress", meaning: "actively being worked" },
            { name: "Done", meaning: "complete and verified" },
            { name: "Blocked", meaning: "waiting on something outside this board" },
        ],
        typeTags: [
            { name: "bug", description: "incorrect behavior" },
            { name: "feature", description: "new capability" },
            { name: "documentation", description: "docs, examples, and typo-level edits" },
            { name: "spike", description: "research or prototype" },
        ],
        priorityTags: [
            { name: "critical", description: "blocks the release" },
            { name: "high", description: "important, do next" },
            { name: "medium", description: "normal priority" },
            { name: "low", description: "nice to have" },
        ],
        tagStyle: "prefixed",
        enforceTags: false,
        wipLimits: {},
        customFields: [],
        mirrorRelations: true,
    };
}

/** The generic answers used for the repo-shipped SKILL.md. */
export function skillPlaceholderAnswers(): SetupAnswers {
    const answers = defaultAnswers(process.cwd());
    answers.boardRoot = PLACEHOLDER_BOARD_ROOT;
    answers.projectName = PLACEHOLDER_PROJECT_NAME;
    return answers;
}

function resolveAnswers(root: string, existing?: SetupAnswers): SetupAnswers {
    const defaults = defaultAnswers(root);
    if (!existing) {
        return defaults;
    }
    // Amend: governed by the persisted values, falling back to defaults for
    // fields the persisted manifest does not carry.
    return {
        boardRoot: root,
        projectName: existing.projectName || defaults.projectName,
        columns: existing.columns?.length ? existing.columns : defaults.columns,
        typeTags: existing.typeTags?.length ? existing.typeTags : defaults.typeTags,
        priorityTags: existing.priorityTags?.length ? existing.priorityTags : defaults.priorityTags,
        tagStyle: existing.tagStyle || defaults.tagStyle,
        enforceTags: existing.enforceTags ?? defaults.enforceTags,
        wipLimits: existing.wipLimits ?? defaults.wipLimits,
        customFields: existing.customFields ?? defaults.customFields,
        mirrorRelations: existing.mirrorRelations ?? defaults.mirrorRelations,
    };
}

// ---- parsing helpers for prompt answers -------------------------------

function parseColumns(raw: string): SetupColumn[] {
    return raw
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const eq = part.indexOf("=");
            if (eq === -1) {
                throw new Error(`expected "Name=meaning", got "${part}"`);
            }
            return { name: part.slice(0, eq).trim(), meaning: part.slice(eq + 1).trim() };
        })
        .filter((c) => c.name.length > 0);
}

function parseTags(raw: string): SetupTagVocab[] {
    return raw
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const eq = part.indexOf("=");
            return eq === -1
                ? { name: part, description: "" }
                : { name: part.slice(0, eq).trim(), description: part.slice(eq + 1).trim() };
        })
        .filter((t) => t.name.length > 0);
}

function parseWip(raw: string): Record<string, number> {
    const limits: Record<string, number> = {};
    for (const part of raw.split("|").map((p) => p.trim()).filter(Boolean)) {
        const eq = part.indexOf("=");
        if (eq === -1) {
            throw new Error(`expected "Column=limit", got "${part}"`);
        }
        const name = part.slice(0, eq).trim();
        const value = Number.parseInt(part.slice(eq + 1).trim(), 10);
        if (Number.isNaN(value) || value < 0) {
            throw new Error(`limit must be a non-negative number, got "${part}"`);
        }
        limits[name] = value;
    }
    return limits;
}

function parseCustomFields(raw: string): SetupCustomField[] {
    return raw
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const bits = part.split(":");
            if (bits.length < 2) {
                throw new Error(`expected "name:type[:required]", got "${part}"`);
            }
            return {
                name: bits[0].trim(),
                type: bits[1].trim(),
                required: (bits[2] ?? "").trim().toLowerCase() === "required" || (bits[2] ?? "").trim() === "1",
            };
        });
}

function formatColumns(columns: SetupColumn[]): string {
    return columns.map((c) => `${c.name}=${c.meaning}`).join("|");
}

function formatTags(tags: SetupTagVocab[]): string {
    return tags.map((t) => `${t.name}${t.description ? `=${t.description}` : ""}`).join("|");
}

function formatWip(limits: Record<string, number>): string {
    return Object.entries(limits)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${k}=${v}`)
        .join("|");
}

function formatCustomFields(fields: SetupCustomField[]): string {
    return fields.map((f) => `${f.name}:${f.type}${f.required ? ":required" : ""}`).join("|");
}

// ---- the prompt loop ---------------------------------------------------

interface PromptRunner {
    ask: (question: string) => Promise<string>;
    note?: (text: string) => void;
}

async function promptLoop(runner: PromptRunner, answers: SetupAnswers): Promise<SetupAnswers> {
    const askParsed = async <T>(
        question: string,
        defaultValue: string,
        parse: (raw: string) => T,
        allowEmpty: boolean
    ): Promise<{ value: T | null; raw: string }> => {
        const suffix = defaultValue ? ` [${defaultValue}]` : "";
        for (let attempt = 0; attempt < 3; attempt++) {
            const raw = (await runner.ask(`${question}${suffix}: `)).trim();
            if (raw === "") {
                if (allowEmpty) {
                    return { value: null, raw: "" };
                }
                if (defaultValue) {
                    return { value: parse(defaultValue), raw: defaultValue };
                }
                return { value: null, raw: "" };
            }
            try {
                return { value: parse(raw), raw };
            } catch (err) {
                runner.note?.(`  invalid (${(err as Error).message}) - try again`);
            }
        }
        runner.note?.(`  keeping the default: ${defaultValue}`);
        return { value: defaultValue ? parse(defaultValue) : null, raw: defaultValue };
    };

    const columns = await askParsed(
        "Board columns as Name=meaning, separated by | (blank = keep default)",
        formatColumns(answers.columns),
        parseColumns,
        false
    );
    if (columns.value) {
        answers.columns = columns.value;
    }

    const typeTags = await askParsed(
        "Type tags as name=description, separated by | (blank = none)",
        formatTags(answers.typeTags),
        parseTags,
        true
    );
    if (typeTags.value) {
        answers.typeTags = typeTags.value;
    }

    const priorityTags = await askParsed(
        "Priority tags as name=description, separated by | (blank = none)",
        formatTags(answers.priorityTags),
        parseTags,
        true
    );
    if (priorityTags.value) {
        answers.priorityTags = priorityTags.value;
    }

    const style = await askParsed<TagStyle>(
        "Tag style: prefixed (typ:bug, pri:critical) or plain (bug, critical)",
        answers.tagStyle,
        (raw) => {
            const s = raw.trim().toLowerCase();
            if (s === "prefixed" || s === "plain") {
                return s;
            }
            throw new Error('expected "prefixed" or "plain"');
        },
        false
    );
    if (style.value) {
        answers.tagStyle = style.value;
    }

    const enforce = await askParsed<boolean>(
        "Enforce type/priority tags on every ticket?",
        answers.enforceTags ? "yes" : "no",
        (raw) => /^y(es)?$/i.test(raw.trim()),
        false
    );
    if (enforce.value !== null) {
        answers.enforceTags = enforce.value;
    }

    const wip = await askParsed<Record<string, number> | null>(
        "WIP limits as Column=limit, separated by | (blank = none)",
        formatWip(answers.wipLimits),
        parseWip,
        true
    );
    if (wip.value) {
        answers.wipLimits = wip.value;
    }

    const customFields = await askParsed<SetupCustomField[] | null>(
        "Custom fields as name:type[:required], separated by | (blank = none)",
        formatCustomFields(answers.customFields),
        parseCustomFields,
        true
    );
    if (customFields.value) {
        answers.customFields = customFields.value;
    }

    const mirror = await askParsed<boolean>(
        "Mirror directed relations on both tasks (depends-on/blocks, duplicate-of/duplicated-by)?",
        answers.mirrorRelations ? "yes" : "no",
        (raw) => /^y(es)?$/i.test(raw.trim()),
        false
    );
    if (mirror.value !== null) {
        answers.mirrorRelations = mirror.value;
    }

    return answers;
}

/** Build a stdin prompt runner. */
export async function promptAnswers(into: SetupAnswers): Promise<SetupAnswers> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    try {
        const runner: PromptRunner = {
            ask: (question) => rl.question(question),
            note: (text) => process.stdout.write(`${text}\n`),
        };
        return await promptLoop(runner, into);
    } finally {
        rl.close();
    }
}

/**
 * Resolve the final answers for a run from the given mode.
 * - --json <file>: answers imported from the file (amended onto defaults).
 * - --yes / no TTY: persisted answers, else defaults.
 * - interactive: prompts with defaults.
 */
export async function collectAnswers(args: {
    root: string;
    yes: boolean;
    jsonFile?: string;
    interactive: boolean;
}): Promise<SetupAnswers> {
    const persisted = readManifest(args.root)?.answers;
    if (args.jsonFile) {
        const raw = fs.readFileSync(args.jsonFile, "utf8");
        const imported = JSON.parse(raw) as Partial<SetupAnswers>;
        return resolveAnswers(args.root, mergeImported(args.root, imported));
    }
    if (args.yes || !args.interactive) {
        const base = resolveAnswers(args.root, persisted);
        return base;
    }
    return promptAnswers(resolveAnswers(args.root, persisted));
}

function mergeImported(root: string, imported: Partial<SetupAnswers>): SetupAnswers {
    const merged: SetupAnswers = resolveAnswers(root, undefined);
    if (imported.projectName) {
        merged.projectName = imported.projectName;
    }
    if (imported.columns?.length) {
        merged.columns = imported.columns;
    }
    if (imported.typeTags?.length) {
        merged.typeTags = imported.typeTags;
    }
    if (imported.priorityTags?.length) {
        merged.priorityTags = imported.priorityTags;
    }
    if (imported.tagStyle) {
        merged.tagStyle = imported.tagStyle;
    }
    if (typeof imported.enforceTags === "boolean") {
        merged.enforceTags = imported.enforceTags;
    }
    if (imported.wipLimits) {
        merged.wipLimits = imported.wipLimits;
    }
    if (imported.customFields) {
        merged.customFields = imported.customFields;
    }
    if (typeof imported.mirrorRelations === "boolean") {
        merged.mirrorRelations = imported.mirrorRelations;
    }
    return merged;
}