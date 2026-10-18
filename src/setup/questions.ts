/**
 * Question set and answer handling for `kanbn-mcp setup`.
 *
 * Every answer has a default, so `--yes` / `--json <file>` runs are fully
 * non-interactive and CI-able. Prompts are Enter-to-accept-default and
 * tolerant of partial answers; re-runs amend from the persisted config.
 *
 * Configuration lives in ONE file: $HOME/.kanbn/kanbn-mcp-config.json. It
 * carries the global (default) answers plus a per-project overrides map keyed
 * by absolute project root - the project directory itself holds no config
 * (a board contains only board files: index.md, tasks/, archive/). Resolution
 * is per-field: defaults <- global answers <- the project's overrides.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { isDeepStrictEqual } from "node:util";
import { PLACEHOLDER_BOARD_ROOT, PLACEHOLDER_PROJECT_NAME } from "./guidance.js";
import {
    ProjectOverrides,
    SetupAnswers,
    SetupColumn,
    SetupConfig,
    SetupCustomField,
    SetupTagVocab,
    TagStyle,
} from "./types.js";

/**
 * Path to the global config file. This file carries configuration only (the
 * board conventions + per-project overrides); it stores no install state, so
 * uninstall/--check derive their target set from it plus host detection.
 */
export function configPath(home: string): string {
    return path.join(home, ".kanbn", "kanbn-mcp-config.json");
}

/** Load the global config, or null when absent/unreadable. */
export function readConfig(home: string): SetupConfig | null {
    try {
        const raw = fs.readFileSync(configPath(home), "utf8");
        const parsed = JSON.parse(raw) as SetupConfig;
        if (parsed.schemaVersion !== 1) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

/** Persist the global config. Configuration only - no write/registration log. */
export function writeConfig(home: string, config: SetupConfig): void {
    fs.mkdirSync(path.dirname(configPath(home)), { recursive: true });
    fs.writeFileSync(configPath(home), JSON.stringify(config, null, 2) + "\n");
}

/**
 * The answer fields that participate in the per-field merge. boardRoot is
 * excluded: it is derived from the resolved project root, never inherited.
 * (A project entry may carry unrelated keys - e.g. the per-project boardPath
 * reserved by the board-path ticket - which this merge ignores.)
 */
const MERGEABLE_ANSWER_FIELDS = [
    "projectName",
    "columns",
    "typeTags",
    "priorityTags",
    "tagStyle",
    "enforceTags",
    "wipLimits",
    "customFields",
    "mirrorRelations",
] as const satisfies readonly (keyof SetupAnswers)[];

/** List fields an empty value means "unset", not "clear" (historic amend semantics). */
const NON_EMPTY_ARRAY_FIELDS = new Set<string>(["columns", "typeTags", "priorityTags"]);

/** Per-field merge: each field present in `source` wins over `base`. */
export function mergeAnswers(base: SetupAnswers, source?: Partial<SetupAnswers>): SetupAnswers {
    const merged: SetupAnswers = { ...base };
    if (source) {
        for (const field of MERGEABLE_ANSWER_FIELDS) {
            const value = source[field];
            if (value === undefined) {
                continue;
            }
            if (NON_EMPTY_ARRAY_FIELDS.has(field) && Array.isArray(value) && value.length === 0) {
                continue;
            }
            (merged as unknown as Record<string, unknown>)[field] = value;
        }
    }
    return merged;
}

/**
 * The answers in force for a board: defaults <- global answers <- the
 * project's overrides (per field). boardRoot always resolves to `root`.
 * @param opts.project when true, the project's override entry is applied
 */
export function resolveAnswers(
    root: string,
    config: SetupConfig | null,
    opts: { project?: boolean } = {}
): SetupAnswers {
    const defaults = defaultAnswers(root);
    let merged = mergeAnswers(defaults, config?.answers);
    if (opts.project) {
        merged = mergeAnswers(merged, config?.projects?.[path.resolve(root)]);
    }
    return { ...merged, boardRoot: path.resolve(root) };
}

/** The answers in force for a board, read from the global config file. */
export function answersFor(root: string, home: string): SetupAnswers {
    return resolveAnswers(root, readConfig(home), { project: true });
}

/**
 * Field-wise diff of the final answers against the global answers: the fields
 * a project actually overrides. A field set back to its global value drops out
 * of the diff - that is how an override is cleared (the field inherits again).
 */
export function projectOverrides(global: SetupAnswers, final: SetupAnswers): ProjectOverrides {
    const overrides: Record<string, unknown> = {};
    for (const field of MERGEABLE_ANSWER_FIELDS) {
        if (!isDeepStrictEqual(final[field], global[field])) {
            overrides[field] = final[field];
        }
    }
    return overrides as ProjectOverrides;
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

export interface PromptRunner {
    ask: (question: string) => Promise<string>;
    /** Display text without registering a read (no trailing newline added). */
    write?: (text: string) => void;
    note?: (text: string) => void;
}

/** Exported for tests: the prompt loop driven by any PromptRunner. */
export async function promptLoop(runner: PromptRunner, answers: SetupAnswers): Promise<SetupAnswers> {
    const askParsed = async <T>(
        question: string,
        defaultValue: string,
        parse: (raw: string) => T,
        allowEmpty: boolean
    ): Promise<{ value: T | null; raw: string }> => {
        // Format multi-value defaults for display - one per indented line
        const defaultLines = defaultValue.split("|").filter(Boolean);
        const hasMultiValueDefault = defaultLines.length > 1;
        
        let displayQuestion: string;
        let displayDefaults: string | undefined;
        
        if (hasMultiValueDefault) {
            // For multi-value defaults: question on its own line, one default
            // per indented line below it.
            displayQuestion = question + ":\n";
            displayDefaults = defaultLines.map(d => `  ${d}`).join("\n");
        } else {
            // For single-value default: keep inline for cleaner look
            displayQuestion = question + " [" + defaultValue + "]: ";
            displayDefaults = undefined;
        }

        let attempt = 0;
        do {
            // Show the question and any multi-line defaults. Display through
            // write(), NEVER ask(): a second pending rl.question() swallows the
            // next input line and the awaited read below never settles (the
            // interactive freeze). The prompt's trailing newline puts the
            // defaults on their own lines.
            runner.write?.(displayQuestion);
            if (displayDefaults) {
                runner.note?.(displayDefaults);
            }

            const raw = await runner.ask("");
            const trimmed = raw.trim();
            
            if (trimmed === "") {
                if (allowEmpty) {
                    return { value: null, raw: "" };
                }
                if (defaultValue) {
                    return { value: parse(defaultValue), raw: defaultValue };
                }
                return { value: null, raw: "" };
            }
            try {
                return { value: parse(trimmed), raw: trimmed };
            } catch (err) {
                runner.note?.(`  invalid (${(err as Error).message}) - try again`);
            }
        } while (++attempt < 3);
        
        // All attempts failed - keep the default
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

/**
 * Build a stdin prompt runner.
 *
 * Input lines are queued, not consumed per-question: readline emits every
 * 'line' in a data chunk synchronously, but promptLoop only registers its
 * next read one tick later. With `rl.question` per prompt, a fast second
 * Enter (or a pasted block of answers) is emitted with no listener attached
 * and silently dropped - the next prompt then waits forever for input that
 * already arrived (the interactive freeze). A persistent 'line' handler
 * buffers those early lines so the queue, not the question call, owns them.
 * EOF/Ctrl+D settles any pending read with "" so trailing prompts fall back
 * to their defaults instead of hanging.
 *
 * Streams are injectable for tests.
 */
export async function promptAnswers(
    into: SetupAnswers,
    options: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream } = {}
): Promise<SetupAnswers> {
    const input = options.input ?? process.stdin;
    const output = options.output ?? process.stdout;
    const rl = readline.createInterface({ input, output });
    const queued: string[] = [];
    let deliver: (() => void) | null = null;
    let ended = false;
    rl.on("line", (line) => {
        queued.push(line);
        deliver?.();
    });
    rl.on("close", () => {
        ended = true;
        deliver?.();
    });
    try {
        const runner: PromptRunner = {
            ask: (question) => {
                if (question) {
                    output.write(question);
                }
                return new Promise<string>((resolve) => {
                    const settle = (): void => {
                        deliver = null;
                        resolve(queued.shift() ?? "");
                    };
                    if (queued.length > 0 || ended) {
                        settle();
                        return;
                    }
                    deliver = settle;
                });
            },
            write: (text) => output.write(text),
            note: (text) => output.write(`${text}\n`),
        };
        return await promptLoop(runner, into);
    } finally {
        rl.close();
    }
}

/**
 * Resolve the final answers for a run from the given mode.
 * - --json <file>: answers imported from the file (amended onto the base).
 * - --yes / no TTY: the base answers for the mode.
 * - interactive: prompts with the base answers as defaults.
 *
 * The base is mode-scoped: `--project` amends against the project's resolved
 * answers (global + this project's overrides); a global run amends against the
 * global answers only - it neither reads nor writes the project section.
 */
export async function collectAnswers(args: {
    root: string;
    home: string;
    yes: boolean;
    jsonFile?: string;
    interactive: boolean;
    project: boolean;
}): Promise<SetupAnswers> {
    const base = resolveAnswers(args.root, readConfig(args.home), { project: args.project });
    if (args.jsonFile) {
        const raw = fs.readFileSync(args.jsonFile, "utf8");
        const imported = JSON.parse(raw) as Partial<SetupAnswers>;
        const merged = mergeAnswers(base, imported);
        merged.boardRoot = path.resolve(args.root);
        return merged;
    }
    if (args.yes || !args.interactive) {
        return base;
    }
    return promptAnswers(base);
}