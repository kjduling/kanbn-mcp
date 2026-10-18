/**
 * `kanbn-mcp setup` / `kanbn-mcp install` / `kanbn-mcp uninstall` entry points.
 *
 * - setup: interactive Q&A for board conventions; writes the project's
 *   AGENTS.md block (the one universal file every agent reads). Per-host
 *   project files are opt-in via --host=<slug>.
 * - install: per-agent wiring only (MCP registration + global skills in $HOME,
 *   for DETECTED hosts only). No board Q&A.
 * - uninstall: reverses everything either command wrote, recomputed from the
 *   board config plus host detection (deterministic, no manifest).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
    ALL_HOST_SLUGS,
    applyRepoEmit,
    BLOCK_END,
    BLOCK_START,
    FILE_MARKER,
    planRepoEmit,
    removeBlock,
    resolveHostSlugs,
    writeManagedFile,
} from "./envelopes.js";
import { renderCanonical, renderGlobalSkill } from "./guidance.js";
import { CLIENTS, clientFor, detectHosts, manualInstallText, registerClient, unregisterClient, choosePath } from "./hosts.js";
import { answersFor, collectAnswers, configPath, projectOverrides, readConfig, resolveAnswers, writeConfig } from "./questions.js";
import { HostSlug, RegisteredTarget, SetupConfig, WrittenTarget } from "./types.js";

export interface SetupArgs {
    yes: boolean;
    jsonFile?: string;
    host?: string;
    repoOnly: boolean;
    mcp: boolean | string[];
    list: boolean;
    dryRun: boolean;
    print: boolean;
    check: boolean;
    /** Amend this project's overrides in the global config (not the global answers). */
    project: boolean;
    positionals: string[];
}

export interface InstallArgs {
    yes: boolean;
    mcp: boolean | string[];
    host?: string;
    list: boolean;
    dryRun: boolean;
    check: boolean;
    positionals: string[];
}

const SETUP_FLAGS = new Set([
    "--yes",
    "--list",
    "--dry-run",
    "--print",
    "--check",
    "--repo-only",
    "--mcp",
    "--host",
    "--ai",
    "--json",
    "--project",
]);

const INSTALL_FLAGS = new Set([
    "--yes",
    "--list",
    "--dry-run",
    "--check",
    "--mcp",
    "--host",
    "--ai",
]);

/** The first non-flag token in an argv list (the subcommand). */
export function findFirstPositional(argv: string[]): string | null {
    for (const arg of argv) {
        if (!arg.startsWith("-")) {
            return arg;
        }
    }
    return null;
}

/**
 * Parse setup/uninstall CLI arguments.
 * @param argv Full CLI args (process.argv.slice(2))
 * @returns Parsed options
 */
export function parseSetupArgs(argv: string[]): SetupArgs {
    const positionals: string[] = [];
    let jsonFile: string | undefined;
    let host: string | undefined;
    let mcp: boolean | string[] = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith("-")) {
            const eq = arg.indexOf("=");
            const bare = eq === -1 ? arg : arg.slice(0, eq);
            if (!SETUP_FLAGS.has(bare)) {
                throw new Error(`Unknown flag "${bare}". Run \`kanbn-mcp --help\` for the full flag list.`);
            }
            // value flags accept both "--json <file>" and "--json=<file>"
            const takeValue = (): string | undefined => {
                if (eq !== -1) {
                    return arg.slice(eq + 1);
                }
                const next = argv[i + 1];
                if (next !== undefined && !next.startsWith("-")) {
                    i += 1;
                    return next;
                }
                return undefined;
            };
            if (bare === "--json") {
                jsonFile = takeValue();
            } else if (bare === "--host" || bare === "--ai") {
                const value = takeValue();
                if (value !== undefined) {
                    host = value;
                }
            } else if (bare === "--mcp") {
                const value = takeValue();
                mcp = value === undefined
                    ? true
                    : value.split(",").map((s) => s.trim()).filter(Boolean);
            }
            // --yes / --list / --dry-run / --print / --check / --repo-only / --project carry no values
        } else {
            positionals.push(arg);
        }
    }
    return {
        yes: argv.includes("--yes"),
        jsonFile,
        host,
        repoOnly: argv.includes("--repo-only"),
        mcp,
        list: argv.includes("--list"),
        dryRun: argv.includes("--dry-run"),
        print: argv.includes("--print"),
        check: argv.includes("--check"),
        project: argv.includes("--project"),
        positionals,
    };
}

/**
 * Parse install CLI arguments.
 * @param argv Full CLI args (process.argv.slice(2))
 * @returns Parsed options
 */
export function parseInstallArgs(argv: string[]): InstallArgs {
    const positionals: string[] = [];
    let host: string | undefined;
    let mcp: boolean | string[] = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith("-")) {
            const eq = arg.indexOf("=");
            const bare = eq === -1 ? arg : arg.slice(0, eq);
            if (!INSTALL_FLAGS.has(bare)) {
                throw new Error(`Unknown flag "${bare}". Run \`kanbn-mcp --help\` for the full flag list.`);
            }
            // value flags accept both "--host <slug>" and "--host=<slug>"
            const takeValue = (): string | undefined => {
                if (eq !== -1) {
                    return arg.slice(eq + 1);
                }
                const next = argv[i + 1];
                if (next !== undefined && !next.startsWith("-")) {
                    i += 1;
                    return next;
                }
                return undefined;
            };
            if (bare === "--host" || bare === "--ai") {
                const value = takeValue();
                if (value !== undefined) {
                    host = value;
                }
            } else if (bare === "--mcp") {
                const value = takeValue();
                mcp = value === undefined
                    ? true
                    : value.split(",").map((s) => s.trim()).filter(Boolean);
            }
            // --list / --dry-run / --check carry no values
        } else {
            positionals.push(arg);
        }
    }
    return {
        yes: argv.includes("--yes"),
        mcp,
        host,
        list: argv.includes("--list"),
        dryRun: argv.includes("--dry-run"),
        check: argv.includes("--check"),
        positionals,
    };
}

function out(text: string): void {
    try {
        process.stdout.write(text + "\n");
    } catch (err) {
        if ((err as NodeJS.ErrnoException)?.code === "EPIPE") {
            // downstream consumer (e.g. `| head`) closed the pipe
            process.exit(0);
        }
        throw err;
    }
}

// EPIPE from a closed downstream pipe arrives as an async stream event, not a
// throw - exit cleanly instead of crashing with an unhandled 'error'.
process.stdout.on("error", (err) => {
    if ((err as NodeJS.ErrnoException)?.code === "EPIPE") {
        process.exit(0);
    }
    throw err;
});

function warn(text: string): void {
    process.stderr.write(`[kanbn-mcp setup] ${text}\n`);
}

function resolveRoot(positionals: string[], cwd: string): string {
    const candidate = positionals.find((p) => p !== "setup" && p !== "uninstall" && p !== "install");
    if (!candidate) {
        return cwd;
    }
    const root = path.resolve(candidate);
    if (!fs.existsSync(root)) {
        throw new Error(`Board root "${candidate}" does not exist.`);
    }
    return root;
}

/** Clients with a local config file `--mcp` can register into (devin is repo-side only). */
const REGISTRABLE_CLIENTS = ["opencode", "claude", "cline", "windsurf", "copilot"];

function selectedMcpClients(mcp: boolean | string[], detected: string[]): string[] {
    if (Array.isArray(mcp)) {
        return mcp;
    }
    if (mcp) {
        return detected.filter((slug) => REGISTRABLE_CLIENTS.includes(slug));
    }
    return [];
}

function listClientsAndTargets(): void {
    out("Detected AI clients:");
    for (const host of detectHosts()) {
        const status = host.detected ? "detected" : "not found";
        out(`  ${host.label.padEnd(16)} ${status.padEnd(10)} ${host.feedback}`);
    }
    out("");
    out("Project guidance (setup): AGENTS.md - one universal block, every agent reads it.");
    out("  Per-host project files (.claude/, .windsurf/, ...) only with `setup --host=<slug>`.");
    out("Global skills (install, detected hosts only):");
    out("  ~/.config/opencode/skills/kanbn/SKILL.md (opencode) | ~/.claude/skills/kanbn/SKILL.md (claude)");
    out("  ~/.cline/skills/kanbn/SKILL.md (cline) | ~/.copilot/skills/kanbn/SKILL.md (copilot)");
    out("");
    out("MCP client registration (--mcp):");
    for (const client of CLIENTS) {
        out(`  ${client.label.padEnd(18)} ${client.defaultPath(os.homedir(), os.homedir())}`);
    }
}

const ROLE_LABELS: Record<string, string> = {
    universal: "universal guidance - every agent reads AGENTS.md",
    opencode: "opencode project skill (.opencode/skills/kanbn/SKILL.md, --host=opencode)",
    claude: "Claude Code guidance (CLAUDE.md, --host=claude)",
    windsurf: "Windsurf rule (.windsurf/rules/kanbn.md, --host=windsurf)",
    cline: "Cline rules + project skill (.clinerules/kanbn.md, --host=cline)",
    devin: "committed skill (Devin, --host=devin)",
    copilot: "Copilot project skill (.github/skills/kanbn/SKILL.md, --host=copilot)",
};

const GLOBAL_LABELS: Record<string, string> = {
    opencode: "global opencode skill (~/.config/opencode/skills/kanbn/SKILL.md)",
    claude: "global Claude skill (~/.claude/skills/kanbn/SKILL.md)",
    cline: "global Cline skill (~/.cline/skills/kanbn/SKILL.md)",
    copilot: "global Copilot skill (~/.copilot/skills/kanbn/SKILL.md)",
};

interface ReportEntry {
    path: string;
    label: string;
    changed: boolean;
}

/** One display entry per written/planned target, with a human role label. */
function describeWrites(written: WrittenTarget[], globalPaths: Set<string>): ReportEntry[] {
    return written.map((t) => {
        const base = ROLE_LABELS[t.host] ?? `${t.host} config`;
        return {
            path: t.path,
            label: globalPaths.has(t.path) ? (GLOBAL_LABELS[t.host] ?? `global ${t.host} skill`) : base,
            changed: t.changed !== false,
        };
    });
}

/** Print where `setup` stores things - the write-side mirror of uninstall's
 * "Removed:" / "Left in place:" report. */
function printWriteReport(writes: ReportEntry[], registrations: RegisteredTarget[], dryRun: boolean): void {
    if (dryRun) {
        out("Would write:");
        for (const w of writes) {
            out(`  - ${w.path} (${w.label})`);
        }
    } else {
        const changed = writes.filter((w) => w.changed);
        const current = writes.filter((w) => !w.changed);
        if (changed.length > 0) {
            out("Wrote:");
            for (const w of changed) {
                out(`  - ${w.path} (${w.label})`);
            }
        }
        if (current.length > 0) {
            out("Unchanged (already current):");
            for (const w of current) {
                out(`  - ${w.path}`);
            }
        }
    }
    if (registrations.length > 0) {
        out(dryRun ? "Would register:" : "Registered:");
        for (const reg of registrations) {
            out(`  - ${reg.message}`);
        }
    }
}

function globalSkillForHost(slug: string, home: string): string | null {
    if (slug === "opencode") {
        return path.join(home, ".config", "opencode", "skills", "kanbn", "SKILL.md");
    }
    if (slug === "claude") {
        return path.join(home, ".claude", "skills", "kanbn", "SKILL.md");
    }
    if (slug === "cline") {
        return path.join(home, ".cline", "skills", "kanbn", "SKILL.md");
    }
    if (slug === "copilot") {
        return path.join(home, ".copilot", "skills", "kanbn", "SKILL.md");
    }
    return null;
}

export interface RunOptions {
    /** Override the home directory (used by tests; defaults to os.homedir()). */
    home?: string;
}

/** Detected host slugs for a home directory. */
function detectedHostSlugs(home: string): HostSlug[] {
    return detectHosts(home).filter((h) => h.detected).map((h) => h.slug as HostSlug);
}

/** Global (per-user) skill targets for the given hosts; hosts with no global skill are skipped. */
function globalSkillTargets(home: string, hostSlugs: HostSlug[] | null, detected: HostSlug[]): { path: string; host: string }[] {
    const targets: { path: string; host: string }[] = [];
    for (const slug of hostSlugs ?? detected) {
        const target = globalSkillForHost(slug, home);
        if (target) {
            targets.push({ path: target, host: slug });
        }
    }
    return targets;
}

/** Registrable MCP clients to act on for the given host selection. */
function registrationClients(hostSlugs: HostSlug[] | null, detected: HostSlug[]): string[] {
    return (hostSlugs ?? detected).filter((slug) => REGISTRABLE_CLIENTS.includes(slug));
}

/** Whether a path carries kanbn-generated content that may be removed. */
function isManaged(target: WrittenTarget): boolean {
    if (!fs.existsSync(target.path)) {
        return false;
    }
    try {
        const content = fs.readFileSync(target.path, "utf8");
        return target.kind === "block"
            ? content.includes(BLOCK_START) && content.includes(BLOCK_END)
            : content.includes(FILE_MARKER);
    } catch {
        return false;
    }
}

/** The main setup flow: board configuration + guidance emission only. */
export async function runSetup(argv: string[], options: RunOptions = {}): Promise<void> {
    const args = parseSetupArgs(argv);
    const root = resolveRoot(args.positionals, process.cwd());
    const home = options.home ?? os.homedir();

    if (args.list) {
        listClientsAndTargets();
        return;
    }

    if (args.check) {
        const config = readConfig(home);
        if (!config) {
            out(`Nothing installed by kanbn-mcp setup in ${root}.`);
            return;
        }
        const hostSlugs = resolveHostSlugs(args.host);
        const answers = resolveAnswers(root, config, { project: true });
        const targets = planRepoEmit(root, answers, hostSlugs).targets;
        out(`kanbn-mcp setup state for ${root}:`);
        out(`  config: ${configPath(home)}`);
        out(`  answers: ${answers.columns.length} columns, ${answers.typeTags.length} type tags, ${answers.priorityTags.length} priority tags, tag style ${answers.tagStyle}`);
        const overrides = config.projects?.[path.resolve(root)];
        if (overrides) {
            out(`  project overrides: ${Object.keys(overrides).length} field(s) for ${path.resolve(root)}`);
        }
        out("  guidance targets (recomputed from the config):");
        for (const target of targets) {
            out(`    - ${isManaged(target) ? "ok" : "MISSING"} ${target.path} (${target.host})`);
        }
        return;
    }

    const interactive = Boolean(process.stdin.isTTY) && !args.yes && !args.jsonFile && !args.print;
    const collected = await collectAnswers({ root, home, yes: args.yes, jsonFile: args.jsonFile, interactive, project: args.project });
    if (!interactive && !args.print && !args.jsonFile && !args.yes) {
        warn("stdin is not interactive; using default/persisted answers. Pass --yes or --json <file> to run non-interactively.");
    }

    // Build the config view in memory first: this run writes exactly ONE
    // section - `answers` (global) or `projects[<root>]` (--project) - and the
    // other section is preserved untouched. Guidance always renders from the
    // merged result (global <- project overrides per field).
    const config: SetupConfig = readConfig(home) ?? { schemaVersion: 1 };
    if (args.project) {
        const globalAnswers = resolveAnswers(root, config);
        config.projects = {
            ...(config.projects ?? {}),
            [path.resolve(root)]: projectOverrides(globalAnswers, collected),
        };
    } else {
        config.answers = collected;
    }
    const answers = resolveAnswers(root, config, { project: true });

    const body = renderCanonical(answers);

    if (args.print) {
        out(body);
        out("");
        out(manualInstallText());
        return;
    }

    const hostSlugs = resolveHostSlugs(args.host);
    const plan = planRepoEmit(root, answers, hostSlugs);

    if (args.dryRun) {
        printWriteReport(
            describeWrites(plan.targets, new Set()),
            [],
            true
        );
        out("");
        out(body);
        return;
    }

    const written = applyRepoEmit(root, answers, hostSlugs);

    // Persist configuration only - no write/registration log. The global
    // answers and the per-project overrides never write each other's section.
    writeConfig(home, config);

    printWriteReport(describeWrites(written, new Set()), [], false);
    out("");
    out("The canonical guidance body (every file above embeds this exact prose):");
    out("");
    out(body);
    out("");
    out("Re-run `kanbn-mcp setup` to amend the answers; `kanbn-mcp uninstall` removes everything above.");
    out("For any client kanbn-mcp setup does not cover, run `kanbn-mcp setup --print` for copy-paste install instructions.");
}

/** The install flow: per-agent wiring only (MCP registration + global skills). No board Q&A. */
export async function runInstall(argv: string[], options: RunOptions = {}): Promise<void> {
    const args = parseInstallArgs(argv);
    const root = resolveRoot(args.positionals, process.cwd());
    const home = options.home ?? os.homedir();

    if (args.list) {
        listClientsAndTargets();
        return;
    }

    if (args.check) {
        // Deterministic check: recompute what would be installed from the config + host detection.
        const detected = detectedHostSlugs(home);
        const hostSlugs = resolveHostSlugs(args.host);
        const targetHosts = hostSlugs ?? detected;

        let mcpClients: string[];
        if (hostSlugs) {
            mcpClients = hostSlugs.filter((slug) => detected.includes(slug));
        } else if (args.mcp === true || Array.isArray(args.mcp)) {
            mcpClients = selectedMcpClients(args.mcp, detected);
        } else {
            mcpClients = detected.filter((slug) => REGISTRABLE_CLIENTS.includes(slug));
        }

        const globalSkills: { path: string; host: string }[] = [];
        if (hostSlugs) {
            for (const slug of hostSlugs) {
                const target = globalSkillForHost(slug, home);
                if (target) {
                    globalSkills.push({ path: target, host: slug });
                }
            }
        } else if (args.mcp !== true && !Array.isArray(args.mcp)) {
            for (const slug of targetHosts) {
                const target = globalSkillForHost(slug, home);
                if (target) {
                    globalSkills.push({ path: target, host: slug });
                }
            }
        }

        out(`kanbn-mcp install state for ${root}:`);
        if (mcpClients.length > 0) {
            out(`  MCP registration (${mcpClients.join(", ")}):`);
            for (const slug of mcpClients) {
                const client = CLIENTS.find((c) => c.client === slug);
                if (client) {
                    const target = choosePath(client, home, root);
                    // Report the chosen target if it exists, otherwise report the
                    // default path as MISSING (matches the path registerClient
                    // would create on an install run).
                    out(`    - ${fs.existsSync(target) ? "ok" : "MISSING"} ${target} (${slug})`);
                }
            }
        } else {
            out("  MCP registration: none (no detected registrable clients)");
        }
        if (globalSkills.length > 0) {
            out("  Global skills:");
            for (const gs of globalSkills) {
                out(`    - ${fs.existsSync(gs.path) ? "ok" : "MISSING"} ${gs.path} (${gs.host})`);
            }
        } else {
            out("  Global skills: none (no target hosts with global skills)");
        }
        return;
    }

    const detected = detectedHostSlugs(home);
    const hostSlugs = resolveHostSlugs(args.host);

    // Determine target hosts: if --host is given, use those; otherwise use all detected hosts
    // (this is the squeez parity: install with no --host targets all detected hosts)
    const targetHosts = hostSlugs ?? detected;

    let mcpClients: string[];
    if (hostSlugs) {
        // --host explicitly limits both MCP registration and global skills to specified hosts
        mcpClients = hostSlugs.filter((slug) => detected.includes(slug));
    } else if (args.mcp === true || Array.isArray(args.mcp)) {
        // --mcp without --host: register MCP for detected registrable clients (backward compat)
        mcpClients = selectedMcpClients(args.mcp, detected);
    } else {
        // No flags: install for all detected hosts (both MCP and global skills)
        mcpClients = detected.filter((slug) => REGISTRABLE_CLIENTS.includes(slug));
    }

    const globalSkills: { path: string; host: string }[] = [];
    if (hostSlugs) {
        // --host: only global skills for specified hosts
        for (const slug of hostSlugs) {
            const target = globalSkillForHost(slug, home);
            if (target) {
                globalSkills.push({ path: target, host: slug });
            }
        }
    } else if (args.mcp !== true && !Array.isArray(args.mcp)) {
        // No --host and no --mcp: install global skills for all target hosts
        for (const slug of targetHosts) {
            const target = globalSkillForHost(slug, home);
            if (target) {
                globalSkills.push({ path: target, host: slug });
            }
        }
    }
    // If --mcp is given without --host, no global skills are installed (backward compat)

    if (args.dryRun) {
        const globalPlans: WrittenTarget[] = globalSkills.map((gs) => ({ path: gs.path, host: gs.host, kind: "file", changed: true }));
        printWriteReport(
            describeWrites(globalPlans, new Set(globalSkills.map((gs) => gs.path))),
            planRegistrations(mcpClients, root, home),
            true
        );
        return;
    }

    const registered: RegisteredTarget[] = [];
    const written: WrittenTarget[] = [];

    // Install global skills: the board-neutral body. Global skills are
    // per-user and shared by every project, so they must not carry this
    // (or any) board's name, root, columns, or tag vocabulary - the project
    // files written by `setup` are the source of those conventions.
    for (const gs of globalSkills) {
        const changed = writeManagedFile(gs.path, renderGlobalSkill());
        written.push({ path: gs.path, host: gs.host, kind: "file", changed });
    }

    // Register the MCP server in each client's config.
    for (const slug of mcpClients) {
        const client = clientFor(slug);
        if (!client) {
            warn(`Unknown MCP client "${slug}" - known: ${CLIENTS.map((c) => c.client).join(", ")}. Skipping.`);
            continue;
        }
        try {
            const outcome = registerClient(slug, { root, home });
            registered.push(outcome);
            // Clean up a registration this client left at another candidate path
            // (e.g. a legacy layout it has since migrated away from). No manifest:
            // every candidate path is checked, and the guarded remove only touches
            // our generated entry, leaving hand-edited ones alone.
            for (const candidate of client.candidates(home, root)) {
                if (candidate !== outcome.path && unregisterClient(candidate, slug)) {
                    out(`cleaned up stale "${slug}" entry in ${candidate}`);
                }
            }
        } catch (err) {
            warn(`could not register ${slug}: ${(err as Error).message}`);
        }
    }

    printWriteReport(describeWrites(written, new Set(globalSkills.map((gs) => gs.path))), registered, false);
    out("");
    out("Run `kanbn-mcp install --check` to verify; `kanbn-mcp uninstall` removes everything above.");
}

function planRegistrations(clients: string[], root: string, home: string): RegisteredTarget[] {
    const plan: RegisteredTarget[] = [];
    for (const slug of clients) {
        const client = clientFor(slug);
        if (!client) {
            continue;
        }
        const target = client.defaultPath(home, root);
        plan.push({
            path: target,
            client: slug,
            message: `would register "${client.server}" in ${target}`,
        });
    }
    return plan;
}

/** Reverse everything `kanbn-mcp setup`/`install` wrote; targets are recomputed
 * from the board config plus host detection, not replayed from a stored manifest. */
export async function runUninstall(argv: string[], options: RunOptions = {}): Promise<void> {
    const args = parseSetupArgs(argv);
    const root = resolveRoot(args.positionals, process.cwd());
    const home = options.home ?? os.homedir();

    const hostSlugs = resolveHostSlugs(args.host);
    const detected = detectedHostSlugs(home);

    const removed: string[] = [];
    const left: string[] = [];

    // 1. Repo guidance - recomputed from the merged config (global + this
    //    board's overrides) + host selection. No stored target list: the
    //    marker guard decides what is ours.
    //
    //    Uninstall sweeps the FULL host matrix, not the setup default: an
    //    older run (or an explicit --host) may have left per-host project
    //    files behind, and the marker guard keeps user-authored files safe.
    const answers = answersFor(root, home);
    for (const target of planRepoEmit(root, answers, hostSlugs ?? ALL_HOST_SLUGS).targets) {
        if (!fs.existsSync(target.path)) {
            continue;
        }
        try {
            if (target.kind === "block") {
                if (removeBlock(target.path)) {
                    removed.push(target.path);
                } else {
                    left.push(`${target.path} (no managed block found)`);
                }
            } else if (fs.readFileSync(target.path, "utf8").includes(FILE_MARKER)) {
                fs.rmSync(target.path, { force: true });
                removed.push(target.path);
            } else {
                left.push(`${target.path} (not generated by kanbn-mcp setup - left in place)`);
            }
        } catch (err) {
            left.push(`${target.path} (${(err as Error).message})`);
        }
    }

    // 2. Global (per-user) skills - recomputed from host detection + host selection.
    for (const gs of globalSkillTargets(home, hostSlugs, detected)) {
        if (!fs.existsSync(gs.path)) {
            continue;
        }
        try {
            if (fs.readFileSync(gs.path, "utf8").includes(FILE_MARKER)) {
                fs.rmSync(gs.path, { force: true });
                removed.push(gs.path);
            } else {
                left.push(`${gs.path} (not generated by kanbn-mcp setup - left in place)`);
            }
        } catch (err) {
            left.push(`${gs.path} (${(err as Error).message})`);
        }
    }

    // 3. MCP registrations - every candidate path for each targeted client, so a
    //    registration left in a stale layout is cleaned too. The entry-shape guard
    //    inside unregisterClient leaves hand-edited entries alone.
    for (const slug of registrationClients(hostSlugs, detected)) {
        const client = clientFor(slug);
        if (!client) {
            continue;
        }
        for (const candidate of client.candidates(home, root)) {
            if (!fs.existsSync(candidate)) {
                continue;
            }
            try {
                if (unregisterClient(candidate, slug)) {
                    removed.push(candidate);
                }
            } catch (err) {
                left.push(`${candidate} (${(err as Error).message})`);
            }
        }
    }

    if (removed.length === 0 && left.length === 0) {
        out(`Nothing installed by kanbn-mcp setup in ${root}.`);
    } else {
        out("Removed:");
        for (const item of removed) {
            out(`  - ${item}`);
        }
        if (left.length) {
            out("Left in place:");
            for (const item of left) {
                out(`  - ${item}`);
            }
        }
    }

    // 4. The global config is user-level configuration shared across projects:
    //    uninstall deliberately leaves it behind (guidance is reversible from
    //    the marker guards alone; the user's answers are not ours to delete).
    if (fs.existsSync(configPath(home))) {
        out(`Configuration left in place: ${configPath(home)}`);
    }
}