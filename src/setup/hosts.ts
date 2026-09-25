/**
 * Host detection and MCP client registration for `kanbn-mcp setup`.
 *
 * Detection mirrors squeez's approach: look for each client's known config
 * locations on the machine. Registration writes the kanbn MCP server entry
 * into that client's config with a guarded merge (never duplicate, never
 * clobbers unrelated entries). Files that can't be parsed are reported with a
 * copy-paste snippet instead - the human-setup fallback.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { RegisteredTarget } from "./types.js";

export interface HostInfo {
    slug: string;
    label: string;
    detected: boolean;
    feedback: string;
}

export function detectHosts(home: string = os.homedir()): HostInfo[] {
    const exists = (p: string): boolean => {
        try {
            return fs.existsSync(p);
        } catch {
            return false;
        }
    };
    return [
        {
            slug: "opencode",
            label: "opencode",
            detected: exists(path.join(home, ".config", "opencode")),
            feedback: "project .opencode/skills/kanbn/SKILL.md + AGENTS.md block; global skill at ~/.config/opencode/skills/kanbn/SKILL.md via --host=opencode",
        },
        {
            slug: "claude",
            label: "Claude (Code / Desktop)",
            detected: exists(path.join(home, ".claude")) || exists(path.join(home, ".claude.json")),
            feedback: "CLAUDE.md block; global skill at ~/.claude/skills/kanbn/SKILL.md via --host=claude",
        },
        {
            slug: "windsurf",
            label: "Windsurf",
            detected: exists(path.join(home, ".codeium", "windsurf")),
            feedback: "project .windsurf/rules/kanbn.md",
        },
        {
            slug: "cline",
            label: "Cline",
            detected: exists(path.join(home, "Documents", "Cline")) || exists(path.join(home, ".clinerules")),
            feedback: "project .clinerules/kanbn.md",
        },
        {
            slug: "devin",
            label: "Devin",
            detected: true,
            feedback: "repo AGENTS.md block + committed skills/kanbn/SKILL.md (Devin reads committed guidance)",
        },
    ];
}

interface ClientRegistration {
    client: string;
    label: string;
    candidates: (home: string, root: string) => string[];
    defaultPath: (home: string, root: string) => string;
    merge: (config: Record<string, unknown>) => boolean;
    remove: (config: Record<string, unknown>) => boolean;
    snippet: () => string;
}

const OPENCODE_ENTRY = { type: "local", command: ["kanbn-mcp"], enabled: true };
const CLAUDE_ENTRY = { command: "kanbn-mcp", args: [] };
const CLINE_ENTRY = { transport: { type: "stdio", command: "kanbn-mcp", args: [""] } };
const WINDSURF_ENTRY = { command: "kanbn-mcp", args: [] };

function mergeOnce(config: Record<string, unknown>, key: string, entry: unknown): boolean {
    if (config[key] === undefined) {
        config[key] = entry;
        return true;
    }
    return false;
}

function removeOnce(config: Record<string, unknown>, key: string, entry?: unknown): boolean {
    const current = config[key];
    if (current === undefined) {
        return false;
    }
    if (entry !== undefined) {
        const merged = JSON.stringify(current) === JSON.stringify(entry);
        if (!merged) {
            // A different value: same server id, different settings. Leave it
            // alone rather than guessing.
            return false;
        }
    }
    delete config[key];
    return true;
}

export const CLIENTS: ClientRegistration[] = [
    {
        client: "opencode",
        label: "opencode",
        candidates: (home, root) => [
            path.join(root, "opencode.json"),
            path.join(root, "opencode.jsonc"),
            path.join(home, ".config", "opencode", "opencode.json"),
            path.join(home, ".config", "opencode", "opencode.jsonc"),
        ],
        defaultPath: (_home, root) => path.join(root, "opencode.json"),
        merge: (config) => {
            const mcp = (config.mcp ?? {}) as Record<string, unknown>;
            const changed = mergeOnce(mcp, "kanbn", OPENCODE_ENTRY);
            config.mcp = mcp;
            return changed;
        },
        remove: (config) => {
            const mcp = (config.mcp ?? {}) as Record<string, unknown>;
            const changed = removeOnce(mcp, "kanbn", OPENCODE_ENTRY);
            if (Object.keys(mcp).length === 0) {
                delete config.mcp;
            }
            return changed;
        },
        snippet: () => JSON.stringify({ mcp: { kanbn: OPENCODE_ENTRY } }, null, 4),
    },
    {
        client: "claude",
        label: "Claude (Code)",
        candidates: (home) => [path.join(home, ".claude.json")],
        defaultPath: (home) => path.join(home, ".claude.json"),
        merge: (config) => {
            const mcp = (config.mcpServers ?? {}) as Record<string, unknown>;
            const changed = mergeOnce(mcp, "kanbn", CLAUDE_ENTRY);
            config.mcpServers = mcp;
            return changed;
        },
        remove: (config) => {
            const mcp = (config.mcpServers ?? {}) as Record<string, unknown>;
            const changed = removeOnce(mcp, "kanbn", CLAUDE_ENTRY);
            return changed;
        },
        snippet: () => JSON.stringify({ mcpServers: { kanbn: CLAUDE_ENTRY } }, null, 4),
    },
    {
        client: "cline",
        label: "Cline",
        candidates: (home) => [
            path.join(home, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json"),
            path.join(home, "Documents", "Cline", "cline_mcp_settings.json"),
        ],
        defaultPath: (home) => path.join(home, "Documents", "Cline", "cline_mcp_settings.json"),
        merge: (config) => {
            const mcp = (config.mcpServers ?? {}) as Record<string, unknown>;
            const changed = mergeOnce(mcp, "kanbn", CLINE_ENTRY);
            config.mcpServers = mcp;
            return changed;
        },
        remove: (config) => {
            const mcp = (config.mcpServers ?? {}) as Record<string, unknown>;
            const changed = removeOnce(mcp, "kanbn", CLINE_ENTRY);
            return changed;
        },
        snippet: () => JSON.stringify({ mcpServers: { kanbn: CLINE_ENTRY } }, null, 4),
    },
    {
        client: "windsurf",
        label: "Windsurf",
        candidates: (home) => [path.join(home, ".codeium", "windsurf", "mcp_config.json")],
        defaultPath: (home) => path.join(home, ".codeium", "windsurf", "mcp_config.json"),
        merge: (config) => {
            const mcp = (config.mcpServers ?? {}) as Record<string, unknown>;
            const changed = mergeOnce(mcp, "kanbn", WINDSURF_ENTRY);
            config.mcpServers = mcp;
            return changed;
        },
        remove: (config) => {
            const mcp = (config.mcpServers ?? {}) as Record<string, unknown>;
            const changed = removeOnce(mcp, "kanbn", WINDSURF_ENTRY);
            return changed;
        },
        snippet: () => JSON.stringify({ mcpServers: { kanbn: WINDSURF_ENTRY } }, null, 4),
    },
];

export function clientFor(slug: string): ClientRegistration | undefined {
    return CLIENTS.find((c) => c.client === slug);
}

/** Parse JSON, tolerating // and /* *\/ comments (opencode.jsonc style). */
export function readJsonLoose(filePath: string): { ok: boolean; config?: Record<string, unknown>; error?: string } {
    let raw: string;
    try {
        raw = fs.readFileSync(filePath, "utf8");
    } catch (err) {
        return { ok: false, error: `cannot read ${filePath}: ${(err as Error).message}` };
    }
    try {
        return { ok: true, config: JSON.parse(raw) as Record<string, unknown> };
    } catch {
        // fall back to comment-stripped parse
        const stripped = raw
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
        try {
            return { ok: true, config: JSON.parse(stripped) as Record<string, unknown> };
        } catch (err) {
            return { ok: false, error: `cannot parse ${filePath}: ${(err as Error).message}` };
        }
    }
}

function writeJson(filePath: string, config: Record<string, unknown>): void {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2) + "\n");
}

export interface RegisterOutcome extends RegisteredTarget {
    changed: boolean;
}

function choosePath(client: ClientRegistration, home: string, root: string): string {
    for (const candidate of client.candidates(home, root)) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return client.defaultPath(home, root);
}

/**
 * Add the kanbn MCP server entry to a client's config with a guarded merge.
 * @param slug Client slug (opencode | claude | cline | windsurf)
 * @param options Options
 * @returns The registration outcome
 */
export function registerClient(
    slug: string,
    options: { root: string; home?: string }
): RegisterOutcome {
    const client = clientFor(slug);
    if (!client) {
        throw new Error(`Unknown MCP client "${slug}". Known clients: opencode, claude, cline, windsurf.`);
    }
    const home = options.home ?? os.homedir();
    const filePath = choosePath(client, home, options.root);

    if (!fs.existsSync(filePath)) {
        const config: Record<string, unknown> = {};
        client.merge(config);
        writeJson(filePath, config);
        return { path: filePath, client: slug, changed: true, message: `registered in ${filePath}` };
    }

    const parsed = readJsonLoose(filePath);
    if (!parsed.ok || parsed.config === undefined) {
        return {
            path: filePath,
            client: slug,
            changed: false,
            message: `could not parse ${filePath}; add this by hand:\n${client.snippet()}`,
        };
    }
    const changed = client.merge(parsed.config);
    if (changed) {
        writeJson(filePath, parsed.config);
        return {
            path: filePath,
            client: slug,
            changed: true,
            message: `added "kanbn" to ${filePath}`,
        };
    }
    return { path: filePath, client: slug, changed: false, message: `"kanbn" already present in ${filePath}` };
}

/**
 * Remove the kanbn MCP server entry from a client's config, if it exists.
 * @param filePath Config file
 * @param slug Client slug
 * @returns Whether an entry was removed
 */
export function unregisterClient(filePath: string, slug: string): boolean {
    const client = clientFor(slug);
    if (!client || !fs.existsSync(filePath)) {
        return false;
    }
    const parsed = readJsonLoose(filePath);
    if (!parsed.ok || parsed.config === undefined) {
        return false;
    }
    const changed = client.remove(parsed.config);
    if (changed) {
        writeJson(filePath, parsed.config);
    }
    return changed;
}

/** Manual-install instructions for the human-setup fallback. */
export function manualInstallText(): string {
    const lines = [
        "Manual install (any client, no command needed):",
        "",
        "1. Guidance files - copy this page's prose into the files each client reads:",
        "   - AGENTS.md (project root) - universal; most agents pick this up automatically.",
        "   - .opencode/skills/kanbn/SKILL.md - opencode project skill.",
        "   - CLAUDE.md (project root) - Claude Code.",
        "   - .windsurf/rules/kanbn.md - Windsurf.",
        "   - .clinerules/kanbn.md - Cline.",
        "   - skills/kanbn/SKILL.md - commit it; Devin and global skill installs read committed SKILL.md files.",
        "   For an unknown client, put the prose wherever that client reads rules or instructions.",
        "2. MCP server - register the kanbn-mcp command in the client's MCP server config:",
    ];
    for (const client of CLIENTS) {
        lines.push(`   - ${client.label}: add the "kanbn" entry to its MCP config file (see --help / README shapes):`);
        for (const line of client.snippet().split("\n")) {
            lines.push(`     ${line}`);
        }
    }
    lines.push(
        "   Any other client: point its MCP server config at the `kanbn-mcp` command (after",
        "   `npm install -g @kduling/kanbn-mcp`), with empty args or a literal `mcp` argument.",
        "",
        "You can also recompute all of this with `kanbn-mcp setup --print`."
    );
    return lines.join("\n");
}