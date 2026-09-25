/**
 * `kanbn-mcp setup` / `kanbn-mcp uninstall` entry point.
 *
 * One interactive Q&A collects the board conventions; the answers render into
 * ONE canonical client-neutral guidance body which is emitted into the files
 * each AI client reads (AGENTS.md, SKILL.md, CLAUDE.md, rule files). `--mcp`
 * additionally registers the kanbn MCP server in detected client configs.
 * Re-runs amend from .kanbn/setup.json; `uninstall` reverses via the manifest.
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
import { HostSlug, RegisteredTarget, SetupManifest, WrittenTarget } from "./types.js";

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

const KNOWN_FLAGS = new Set([
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
            if (!KNOWN_FLAGS.has(bare)) {
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
    const candidate = positionals.find((p) => p !== "setup" && p !== "uninstall");
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
const REGISTRABLE_CLIENTS = ["opencode", "claude", "cline", "windsurf"];

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
    out("  AGENTS.md (universal) | .opencode/skills/kanbn/SKILL.md | CLAUDE.md | .windsurf/rules/kanbn.md | .clinerules/kanbn.md | skills/kanbn/SKILL.md");
    out("  Global skills (--host=opencode / --host=claude): ~/.config/opencode/skills/kanbn/SKILL.md / ~/.claude/skills/kanbn/SKILL.md");
    out("");
    out("MCP client registration (--mcp):");
    for (const client of CLIENTS) {
        out(`  ${client.label.padEnd(18)} ${client.defaultPath(os.homedir(), os.homedir())}`);
    }
}

function printPlannedWrites(targets: WrittenTarget[], registrations: RegisteredTarget[], dryRun: boolean): void {
    out(`${dryRun ? "would write" : "wrote"}:`);
    for (const target of targets) {
        out(`  - ${target.path}`);
    }
    for (const reg of registrations) {
        out(`  - ${reg.message}`);
    }
}

function globalSkillForHost(slug: string, home: string): string | null {
    if (slug === "opencode") {
        return path.join(home, ".config", "opencode", "skills", "kanbn", "SKILL.md");
    }
    if (slug === "claude") {
        return path.join(home, ".claude", "skills", "kanbn", "SKILL.md");
    }
    return null;
}

export interface RunOptions {
    /** Override the home directory (used by tests; defaults to os.homedir()). */
    home?: string;
}

/** The main setup flow. */
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

    const detected = detectHosts(home).filter((h) => h.detected).map((h) => h.slug);
    const mcpClients = selectedMcpClients(args.mcp, detected);
    const globalSkills: { path: string; host: string }[] = [];
    if (hostSlugs) {
        for (const slug of hostSlugs) {
            const target = globalSkillForHost(slug, home);
            if (target) {
                globalSkills.push({ path: target, host: slug });
            }
        }
    }

    if (args.dryRun) {
        printPlannedWrites(plan.targets, planRegistrations(args.mcp, root, true, home), true);
        for (const gs of globalSkills) {
            out(`would write global skill: ${gs.path}`);
        }
        out("");
        out(body);
        return;
    }

    const written = applyRepoEmit(root, answers, hostSlugs);
    for (const gs of globalSkills) {
        writeManagedFile(gs.path, renderSkill(answers));
        written.push({ path: gs.path, host: gs.host, kind: "file" });
    }

    const registered: RegisteredTarget[] = [];
    if (mcpClients.length > 0) {
        for (const slug of mcpClients) {
            const client = CLIENTS.find((c) => c.client === slug);
            if (!client) {
                warn(`Unknown MCP client "${slug}" - known: ${CLIENTS.map((c) => c.client).join(", ")}. Skipping.`);
                continue;
            }
            try {
                registered.push(registerClient(slug, { root, home }));
            } catch (err) {
                warn(`could not register ${slug}: ${(err as Error).message}`);
            }
        }
    }

    const manifest: SetupManifest = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        answers,
        written,
        registered,
    };
    writeManifest(root, manifest);

    printPlannedWrites(written, registered, false);
    out("");
    out("The canonical guidance body (every file above embeds this exact prose):");
    out("");
    out(body);
    out("");
    out("Re-run `kanbn-mcp setup` to amend the answers; `kanbn-mcp uninstall` removes everything above.");
    out("For any client kanbn-mcp setup does not cover, run `kanbn-mcp setup --print` for copy-paste install instructions.");
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
            message: `would register "kanbn" in ${target}`,
        });
    }
    return plan;
}

/** Reverse everything `kanbn-mcp setup` wrote, using the manifest. */
export async function runUninstall(argv: string[], options: RunOptions = {}): Promise<void> {
    const args = parseSetupArgs(argv);
    const root = resolveRoot(args.positionals, process.cwd());
    const manifest = readManifest(root);
    if (!manifest) {
        out(`Nothing installed by kanbn-mcp setup in ${root}.`);
        return;
    }
    const removed: string[] = [];
    const left: string[] = [];
    for (const target of manifest.written) {
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
        try {
            if (unregisterClient(reg.path, reg.client)) {
                removed.push(reg.path);
            } else {
                left.push(`${reg.path} (no kanbn entry or entry differs from the generated shape)`);
            }
        } catch (err) {
            left.push(`${reg.path} (${(err as Error).message})`);
        }
    }
    try {
        fs.rmSync(manifestPath(root), { force: true });
        removed.push(manifestPath(root));
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