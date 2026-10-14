/**
 * `kanbn-mcp setup` / `kanbn-mcp install` / `kanbn-mcp uninstall` entry points.
 *
 * - setup: interactive Q&A for board conventions; emits per-client guidance envelopes.
 * - install: per-agent wiring only (MCP registration + global skills). No board Q&A.
 * - uninstall: reverses everything either command wrote (deterministic, no manifest).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
    applyRepoEmit,
    FILE_MARKER,
    planRepoEmit,
    removeBlock,
    resolveHostSlugs,
    writeManagedFile,
} from "./envelopes.js";
import { renderCanonical, renderSkill } from "./guidance.js";
import { CLIENTS, detectHosts, manualInstallText, registerClient, unregisterClient } from "./hosts.js";
import { collectAnswers, manifestPath, readManifest, writeManifest } from "./questions.js";
import { HostSlug, RegisteredTarget, SetupManifest, WrittenTarget, SetupAnswers } from "./types.js";
import { defaultAnswers } from "./questions.js";

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
            // --yes / --list / --dry-run / --print / --check / --repo-only carry no values
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
    out("Guidance targets (from the board root):");
    out("  AGENTS.md (universal) | .opencode/skills/kanbn/SKILL.md | CLAUDE.md | .windsurf/rules/kanbn.md | .clinerules/kanbn.md | skills/kanbn/SKILL.md | .github/skills/kanbn/SKILL.md");
    out("  Global skills (--host=opencode / --host=claude / --host=cline / --host=copilot): ~/.config/opencode/skills/kanbn/SKILL.md / ~/.claude/skills/kanbn/SKILL.md / ~/.cline/skills/kanbn/SKILL.md / ~/.copilot/skills/kanbn/SKILL.md");
    out("");
    out("MCP client registration (--mcp):");
    for (const client of CLIENTS) {
        out(`  ${client.label.padEnd(18)} ${client.defaultPath(os.homedir(), os.homedir())}`);
    }
}

const ROLE_LABELS: Record<string, string> = {
    universal: "universal guidance - every agent reads AGENTS.md",
    opencode: "opencode project skill (.opencode/skills/kanbn/SKILL.md)",
    claude: "Claude Code guidance (CLAUDE.md)",
    windsurf: "Windsurf rule (.windsurf/rules/kanbn.md)",
    cline: "Cline rules + project skill (.clinerules/kanbn.md, .cline/skills/kanbn/SKILL.md)",
    devin: "committed skill (Devin + global skill installs)",
    copilot: "Copilot project skill (.github/skills/kanbn/SKILL.md)",
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
function printWriteReport(writes: ReportEntry[], registrations: RegisteredTarget[], dryRun: boolean, manifestFile: string | null): void {
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
    if (manifestFile && !dryRun) {
        out("Stored manifest:");
        out(`  - ${manifestFile}`);
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
        const manifest = readManifest(root);
        if (!manifest) {
            out(`Nothing installed by kanbn-mcp setup in ${root}.`);
            return;
        }
        out(`kanbn-mcp setup state for ${root}:`);
        out(`  answers: ${manifest.answers.columns.length} columns, ${manifest.answers.typeTags.length} type tags, ${manifest.answers.priorityTags.length} priority tags, tag style ${manifest.answers.tagStyle}`);
        out(`  written: ${manifest.written.length}`);
        for (const target of manifest.written) {
            out(`    - ${fs.existsSync(target.path) ? "ok" : "MISSING"} ${target.path}`);
        }
        out(`  registered: ${manifest.registered.length}`);
        for (const reg of manifest.registered) {
            out(`    - ${fs.existsSync(reg.path) ? "ok" : "MISSING"} ${reg.path} (${reg.client})`);
        }
        return;
    }

    const interactive = Boolean(process.stdin.isTTY) && !args.yes && !args.jsonFile && !args.print;
    const answers = await collectAnswers({ root, yes: args.yes, jsonFile: args.jsonFile, interactive });
    if (!interactive && !args.print && !args.jsonFile && !args.yes) {
        warn("stdin is not interactive; using default/persisted answers. Pass --yes or --json <file> to run non-interactively.");
    }

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
            true,
            null
        );
        out("");
        out(body);
        return;
    }

    const written = applyRepoEmit(root, answers, hostSlugs);

    const manifest: SetupManifest = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        answers,
        written,
        registered: [],
    };
    writeManifest(root, manifest);

    printWriteReport(describeWrites(written, new Set()), [], false, manifestPath(root));
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
        // Deterministic check: recompute what would be installed from current config + host detection
        const detected = detectHosts(home).filter((h) => h.detected).map((h) => h.slug);
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
                    const target = client.defaultPath(home, root);
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

    // Load existing board config for global skill rendering (uses the same answers as setup)
    const existingManifest = readManifest(root);
    const answers = existingManifest ? existingManifest.answers : defaultAnswers(root);

    const detected = detectHosts(home).filter((h) => h.detected).map((h) => h.slug);
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
        // For dry-run, use the same mcpClients logic
        const dryRunMcpClients = hostSlugs
            ? hostSlugs.filter((slug) => detected.includes(slug))
            : (args.mcp === true || Array.isArray(args.mcp))
                ? selectedMcpClients(args.mcp, detected)
                : detected.filter((slug) => REGISTRABLE_CLIENTS.includes(slug));
        printWriteReport(
            describeWrites(globalPlans, new Set(globalSkills.map((gs) => gs.path))),
            planRegistrations(dryRunMcpClients, root, true, home),
            true,
            null
        );
        return;
    }

    const registered: RegisteredTarget[] = [];
    const written: WrittenTarget[] = [];

    // Install global skills
    for (const gs of globalSkills) {
        const changed = writeManagedFile(gs.path, renderSkill(answers));
        written.push({ path: gs.path, host: gs.host, kind: "file", changed });
    }

    // Register MCP server in client configs
    if (mcpClients.length > 0) {
        for (const slug of mcpClients) {
            const client = CLIENTS.find((c) => c.client === slug);
            if (!client) {
                warn(`Unknown MCP client "${slug}" - known: ${CLIENTS.map((c) => c.client).join(", ")}. Skipping.`);
                continue;
            }
            try {
                const outcome = registerClient(slug, { root, home });
                registered.push(outcome);
                // Clean up a registration this client previously recorded at a
                // different path so `uninstall` stays complete. Best-effort:
                // if the old entry was hand-edited, the guarded remove leaves it.
                for (const stale of existingManifest?.registered ?? []) {
                    if (stale.client === slug && stale.path !== outcome.path) {
                        if (unregisterClient(stale.path, slug)) {
                            out(`cleaned up stale "${slug}" entry in ${stale.path}`);
                        }
                    }
                }
            } catch (err) {
                warn(`could not register ${slug}: ${(err as Error).message}`);
            }
        }
    }

    // Update manifest with new registered entries (merge with existing, replacing stale paths)
    const priorRegistered = existingManifest?.registered ?? [];
    const mergedRegistered = [
        ...priorRegistered.filter((prior) => !registered.some((r) => r.client === prior.client)),
        ...registered,
    ];
    // Deduplicate by path+client
    const uniqueRegistered = mergedRegistered.filter((reg, index, self) =>
        index === self.findIndex((r) => r.path === reg.path && r.client === reg.client)
    );

    // Merge written entries (global skills) with existing
    const priorWritten = existingManifest?.written ?? [];
    const mergedWritten = [
        ...priorWritten.filter((prior) => !written.some((w) => w.path === prior.path && w.host === prior.host)),
        ...written,
    ];

    const updatedManifest: SetupManifest = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        answers: existingManifest?.answers ?? answers,
        written: mergedWritten,
        registered: uniqueRegistered,
    };
    writeManifest(root, updatedManifest);

    printWriteReport(describeWrites(written, new Set(globalSkills.map((gs) => gs.path))), registered, false, manifestPath(root));
    out("");
    out("Run `kanbn-mcp install --check` to verify; `kanbn-mcp uninstall` removes everything above.");
}

function planRegistrations(mcp: boolean | string[], root: string, dryRun: boolean, home: string): RegisteredTarget[] {
    if (!dryRun) {
        return [];
    }
    const detected = detectHosts(home).filter((h) => h.detected).map((h) => h.slug);
    const clients = selectedMcpClients(mcp, detected);
    const plan: RegisteredTarget[] = [];
    for (const slug of clients) {
        const client = CLIENTS.find((c) => c.client === slug);
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

/** Reverse everything `kanbn-mcp setup`/`install` wrote, using the manifest. */
export async function runUninstall(argv: string[], options: RunOptions = {}): Promise<void> {
    const args = parseSetupArgs(argv);
    const root = resolveRoot(args.positionals, process.cwd());
    const manifest = readManifest(root);
    if (!manifest) {
        out(`Nothing installed by kanbn-mcp setup in ${root}.`);
        return;
    }

    // Filter by --host if provided
    const hostFilter = args.host ? resolveHostSlugs(args.host) : null;
    const filterByHost = (host: string) => hostFilter === null || hostFilter.includes(host as HostSlug);

    const removed: string[] = [];
    const left: string[] = [];
    for (const target of manifest.written) {
        if (!filterByHost(target.host)) {
            left.push(`${target.path} (host "${target.host}" filtered out by --host)`);
            continue;
        }
        try {
            if (target.kind === "block") {
                if (removeBlock(target.path)) {
                    removed.push(target.path);
                } else {
                    left.push(`${target.path} (no managed block found)`);
                }
            } else {
                if (fs.existsSync(target.path) && fs.readFileSync(target.path, "utf8").includes(FILE_MARKER)) {
                    fs.rmSync(target.path, { force: true });
                    removed.push(target.path);
                } else {
                    left.push(`${target.path} (not generated by kanbn-mcp setup - left in place)`);
                }
            }
        } catch (err) {
            left.push(`${target.path} (${(err as Error).message})`);
        }
    }
    for (const reg of manifest.registered) {
        if (!filterByHost(reg.client)) {
            left.push(`${reg.path} (client "${reg.client}" filtered out by --host)`);
            continue;
        }
        try {
            if (unregisterClient(reg.path, reg.client)) {
                removed.push(reg.path);
            } else {
                left.push(`${reg.path} (no ${reg.client} entry or entry differs from the generated shape)`);
            }
        } catch (err) {
            left.push(`${reg.path} (${(err as Error).message})`);
        }
    }
    try {
        if (hostFilter === null) {
            // No --host filter: remove everything including the manifest
            fs.rmSync(manifestPath(root), { force: true });
            removed.push(manifestPath(root));
        } else {
            // --host filter: update manifest to keep non-filtered entries
            const remainingWritten = manifest.written.filter((t) => !filterByHost(t.host));
            const remainingRegistered = manifest.registered.filter((r) => !filterByHost(r.client));
            if (remainingWritten.length === 0 && remainingRegistered.length === 0) {
                // Nothing left: remove the manifest
                fs.rmSync(manifestPath(root), { force: true });
                removed.push(manifestPath(root));
            } else {
                const updatedManifest: SetupManifest = {
                    schemaVersion: manifest.schemaVersion,
                    generatedAt: new Date().toISOString(),
                    answers: manifest.answers,
                    written: remainingWritten,
                    registered: remainingRegistered,
                };
                writeManifest(root, updatedManifest);
                out(`  - manifest updated (${remainingWritten.length} written, ${remainingRegistered.length} registered entries remain)`);
            }
        }
    } catch {
        // ignore
    }
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