import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test, { describe, mock } from "node:test";
import { PassThrough } from "node:stream";

import {
    findFirstPositional,
    parseSetupArgs,
    runSetup,
    runInstall,
    runUninstall,
} from "../src/setup/index.js";
import {
    BLOCK_END,
    BLOCK_START,
    FILE_MARKER,
    planRepoEmit,
    removeBlock,
    renderBlock,
    resolveHostSlugs,
    upsertBlock,
    writeManagedFile,
} from "../src/setup/envelopes.js";
import { renderCanonical, renderSkill, SKILL_FRONTMATTER } from "../src/setup/guidance.js";
import { CLIENTS, registerClient, unregisterClient, readJsonLoose, manualInstallText } from "../src/setup/hosts.js";
import { collectAnswers, configPath, defaultAnswers, projectOverrides, promptAnswers, promptLoop, readConfig, resolveAnswers, skillPlaceholderAnswers, PromptRunner } from "../src/setup/questions.js";
import { SetupConfig } from "../src/setup/types.js";

function makeTempDir(): string {
    return mkdtempSync(join(tmpdir(), "kanbn-setup-"));
}

async function captureStdout(fn: () => Promise<void>): Promise<string> {
    let captured = "";
    const m = mock.method(process.stdout, "write", (chunk: string | Uint8Array) => {
        captured += String(chunk);
        return true;
    });
    try {
        await fn();
    } finally {
        m.mock.restore();
    }
    return captured;
}

describe("setup args parsing", () => {
    test("findFirstPositional finds the subcommand, skipping flags", () => {
        assert.equal(findFirstPositional(["setup"]), "setup");
        assert.equal(findFirstPositional(["mcp"]), "mcp");
        assert.equal(findFirstPositional(["uninstall"]), "uninstall");
        assert.equal(findFirstPositional(["setup", "--yes"]), "setup");
        assert.equal(findFirstPositional(["--host=opencode", "setup"]), "setup");
        assert.equal(findFirstPositional(["--yes"]), null);
        assert.equal(findFirstPositional([]), null);
    });

    test("parses the full flag surface", () => {
        assert.equal(parseSetupArgs(["setup", "--yes"]).yes, true);
        assert.equal(parseSetupArgs(["setup"]).yes, false);
        assert.equal(parseSetupArgs(["setup", "--json", "answers.json"]).jsonFile, "answers.json");
        assert.equal(parseSetupArgs(["setup", "--json=answers.json"]).jsonFile, "answers.json");
        assert.equal(parseSetupArgs(["setup", "--host=opencode"]).host, "opencode");
        assert.equal(parseSetupArgs(["setup", "--host=opencode,claude"]).host, "opencode,claude");
        assert.equal(parseSetupArgs(["setup", "--mcp"]).mcp, true);
        assert.deepEqual(parseSetupArgs(["setup", "--mcp=opencode,claude"]).mcp, ["opencode", "claude"]);
        assert.equal(parseSetupArgs(["setup", "--list"]).list, true);
        assert.equal(parseSetupArgs(["setup", "--dry-run"]).dryRun, true);
        assert.equal(parseSetupArgs(["setup", "--print"]).print, true);
        assert.equal(parseSetupArgs(["setup", "--check"]).check, true);
        assert.equal(parseSetupArgs(["setup", "--repo-only"]).repoOnly, true);
        assert.equal(parseSetupArgs(["setup", "--project"]).project, true);
        assert.equal(parseSetupArgs(["setup"]).project, false);
        assert.deepEqual(parseSetupArgs(["setup"]).positionals, ["setup"]);
        assert.deepEqual(parseSetupArgs(["setup", "/some/root"]).positionals, ["setup", "/some/root"]);
    });

    test("rejects unknown flags", () => {
        assert.throws(() => parseSetupArgs(["setup", "--bogus"]), /Unknown flag "--bogus"/);
    });
});

describe("default answers", () => {
    test("has sensible defaults for a non-interactive run", () => {
        const answers = defaultAnswers("/tmp/proj");
        assert.equal(answers.boardRoot, "/tmp/proj");
        assert.equal(answers.projectName, "proj");
        assert.equal(answers.columns.length, 5);
        assert.equal(answers.columns[0].name, "Backlog");
        assert.equal(answers.typeTags.length, 4);
        assert.equal(answers.priorityTags.length, 4);
        assert.equal(answers.tagStyle, "prefixed");
        assert.equal(answers.enforceTags, false);
        assert.deepEqual(answers.wipLimits, {});
        assert.deepEqual(answers.customFields, []);
        assert.equal(answers.mirrorRelations, true);
    });
});

describe("canonical guidance renderer", () => {
    test("is client-neutral: names no AI client", () => {
        const body = renderCanonical(defaultAnswers("/tmp/proj"));
        assert.match(body, /kanbn_create_task/);
        assert.match(body, /kanbn_get_task/);
        assert.match(body, /kanbn_add_relation/);
        assert.match(body, /subTasks/);
        assert.match(body, /kanbn_search/);
        for (const forbidden of ["opencode", "claude", "windsurf", "cline", "devin", "copilot", "claude-code", "SKILL.md", "AGENTS.md", "bobs-nose"]) {
            assert.ok(!body.includes(forbidden), `body must not mention "${forbidden}"`);
        }
    });

    test("includes board conventions from the answers", () => {
        const answers = defaultAnswers("/tmp/proj");
        const body = renderCanonical(answers);
        assert.match(body, /Backlog — queued but not started/);
        assert.match(body, /typ:bug — incorrect behavior/);
        assert.match(body, /pri:critical — blocks the release/);
        assert.match(body, /Project: proj/);
        assert.match(body, /Board root: \/tmp\/proj/);
    });

    test("plain tag style drops the typ:/pri: prefixes", () => {
        const answers = defaultAnswers("/tmp/proj");
        answers.tagStyle = "plain";
        const body = renderCanonical(answers);
        assert.match(body, /- bug — incorrect behavior/);
        assert.ok(!body.includes("typ:bug"));
        assert.ok(!body.includes("pri:critical"));
    });

    test("enforce mode changes the guidance phrasing", () => {
        const answers = defaultAnswers("/tmp/proj");
        answers.enforceTags = true;
        const body = renderCanonical(answers);
        assert.match(body, /vocabulary is enforced/);
        const loose = renderCanonical(defaultAnswers("/tmp/proj"));
        assert.ok(!loose.includes("vocabulary is enforced"));
    });

    test("WIP limits and custom fields render as sections only when present", () => {
        const answers = defaultAnswers("/tmp/proj");
        assert.ok(!renderCanonical(answers).includes("## WIP limits"));
        answers.wipLimits = { "In Progress": 3 };
        const withWip = renderCanonical(answers);
        assert.match(withWip, /## WIP limits/);
        assert.match(withWip, /In Progress: at most 3 in-flight/);

        assert.ok(!renderCanonical(defaultAnswers("/tmp/proj")).includes("## Custom fields"));
        const withFields = defaultAnswers("/tmp/proj");
        withFields.customFields = [{ name: "severity", type: "string", required: true }];
        const body = renderCanonical(withFields);
        assert.match(body, /## Custom fields/);
        assert.match(body, /- severity: string \(required\)/);
    });

    test("relation mirroring off changes the wording", () => {
        const answers = defaultAnswers("/tmp/proj");
        answers.mirrorRelations = false;
        const body = renderCanonical(answers);
        assert.match(body, /recorded in one direction only/);
        assert.ok(!renderCanonical(defaultAnswers("/tmp/proj")).includes("recorded in one direction only"));
    });
});

describe("SKILL.md envelope", () => {
    test("renders frontmatter + body + managed marker", () => {
        const skill = renderSkill(defaultAnswers("/tmp/proj"));
        assert.ok(skill.startsWith(SKILL_FRONTMATTER));
        assert.match(skill, /^---\nname: kanbn/m);
        assert.match(skill, /description: Work with a Kanbn board/);
        assert.ok(skill.includes(FILE_MARKER));
    });

    test("repo-shipped SKILL.md matches the renderer output for placeholder answers", () => {
        const committed = readFileSync("skills/kanbn/SKILL.md", "utf8");
        assert.equal(committed, renderSkill(skillPlaceholderAnswers()));
    });
});

describe("managed blocks", () => {
    test("upsertBlock appends to a file without a block and preserves other content", () => {
        const dir = makeTempDir();
        try {
            const file = join(dir, "AGENTS.md");
            writeFileSync(file, "human content\n");
            const block = renderBlock("## Kanbn board guidance", "the guidance");
            assert.equal(upsertBlock(file, block), true);
            const after = readFileSync(file, "utf8");
            assert.ok(after.includes("human content"));
            assert.ok(after.includes(BLOCK_START));
            assert.equal(after.split(BLOCK_START).length - 1, 1);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("upsertBlock replaces the block idempotently; second run changes nothing", () => {
        const dir = makeTempDir();
        try {
            const file = join(dir, "CLAUDE.md");
            writeFileSync(file, "preamble\n");
            const block = renderBlock("# Kanbn board guidance", "version one");
            upsertBlock(file, block);
            // simulate a re-run with updated content
            const blockTwo = renderBlock("# Kanbn board guidance", "version two");
            assert.equal(upsertBlock(file, blockTwo), true);
            const after = readFileSync(file, "utf8");
            assert.equal(after.split(BLOCK_START).length - 1, 1);
            assert.ok(after.includes("version two"));
            assert.ok(!after.includes("version one"));
            assert.ok(after.startsWith("preamble"));
            // third run with identical content: no change
            assert.equal(upsertBlock(file, blockTwo), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("upsertBlock creates the file when missing", () => {
        const dir = makeTempDir();
        try {
            const file = join(dir, "new.md");
            assert.equal(upsertBlock(file, renderBlock("# T", "b")), true);
            assert.ok(readFileSync(file, "utf8").startsWith(BLOCK_START));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("removeBlock strips the block and keeps surrounding content", () => {
        const dir = makeTempDir();
        try {
            const file = join(dir, "AGENTS.md");
            writeFileSync(file, "top\n\n<!-- custom -->\n\nbottom\n");
            const block = renderBlock("## Kanbn board guidance", "guidance");
            upsertBlock(file, block);
            assert.equal(removeBlock(file), true);
            const after = readFileSync(file, "utf8");
            assert.ok(!after.includes(BLOCK_START));
            assert.ok(after.includes("top"));
            assert.ok(after.includes("bottom"));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("removeBlock deletes a file that contained only the block", () => {
        const dir = makeTempDir();
        try {
            const file = join(dir, "kanbn.md");
            upsertBlock(file, renderBlock("# Kanbn board guidance", "guidance"));
            assert.equal(removeBlock(file), true);
            assert.equal(existsSync(file), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("writeManagedFile refuses to clobber an unmanaged file", () => {
        const dir = makeTempDir();
        try {
            const file = join(dir, "SKILL.md");
            writeFileSync(file, "hand-authored skill\n");
            assert.throws(() => writeManagedFile(file, "---\nname: kanbn\n---\nguidance"), /Refusing to overwrite/);
            assert.equal(readFileSync(file, "utf8"), "hand-authored skill\n");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("writeManagedFile overwrites its own output", () => {
        const dir = makeTempDir();
        try {
            const file = join(dir, "SKILL.md");
            const v1 = renderSkill(defaultAnswers("/tmp/proj"));
            const v2 = renderSkill({ ...defaultAnswers("/tmp/proj"), projectName: "renamed" });
            assert.equal(writeManagedFile(file, v1), true);
            assert.equal(writeManagedFile(file, v2), true);
            assert.ok(readFileSync(file, "utf8").includes("Project: renamed"));
            assert.equal(writeManagedFile(file, v2), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("host slugs", () => {
    test("resolveHostSlugs filters and validates", () => {
        assert.equal(resolveHostSlugs(undefined), null);
        assert.deepEqual(resolveHostSlugs("opencode,claude"), ["opencode", "claude"]);
        assert.deepEqual(resolveHostSlugs("copilot"), ["copilot"]);
        assert.throws(() => resolveHostSlugs("bobs-nose"), /Unknown host "bobs-nose"/);
    });

    test("planRepoEmit covers the full matrix and honors --host", () => {
        const answers = defaultAnswers("/tmp/proj");
        const all = planRepoEmit("/tmp/proj", answers, null);
        assert.deepEqual(
            all.targets.map((t) => t.path),
            [
                "/tmp/proj/AGENTS.md",
                "/tmp/proj/.opencode/skills/kanbn/SKILL.md",
                "/tmp/proj/CLAUDE.md",
                "/tmp/proj/.windsurf/rules/kanbn.md",
                "/tmp/proj/.clinerules/kanbn.md",
                "/tmp/proj/.cline/skills/kanbn/SKILL.md",
                "/tmp/proj/skills/kanbn/SKILL.md",
                "/tmp/proj/.github/skills/kanbn/SKILL.md",
                "/tmp/proj/.cursor/rules/kanbn.md",
                "/tmp/proj/.cursor/skills/kanbn/SKILL.md",
                "/tmp/proj/.continue/rules/kanbn.md",
                "/tmp/proj/.roo/rules/kanbn.md",
                "/tmp/proj/.aider/kanbn.md",
                "/tmp/proj/.gemini/rules/kanbn.md",
                "/tmp/proj/.codex/rules/kanbn.md",
            ]
        );
        const windsurfOnly = planRepoEmit("/tmp/proj", answers, ["windsurf"]);
        assert.deepEqual(windsurfOnly.targets.map((t) => t.path), ["/tmp/proj/.windsurf/rules/kanbn.md"]);
        const opencode = planRepoEmit("/tmp/proj", answers, ["opencode"]);
        assert.deepEqual(
            opencode.targets.map((t) => t.path),
            ["/tmp/proj/AGENTS.md", "/tmp/proj/.opencode/skills/kanbn/SKILL.md"]
        );
        // copilot reads AGENTS.md from the workspace root plus its workspace skill
        const copilot = planRepoEmit("/tmp/proj", answers, ["copilot"]);
        assert.deepEqual(copilot.targets.map((t) => t.path), [
            "/tmp/proj/AGENTS.md",
            "/tmp/proj/.github/skills/kanbn/SKILL.md",
        ]);
    });
});

describe("MCP client registration", () => {
    test("registerClient merges into each client's config shape", () => {
        const dir = makeTempDir();
        try {
            const home = join(dir, "home");
            const configPaths: Record<string, string> = {
                opencode: join(home, ".config", "opencode", "opencode.json"),
                claude: join(home, ".claude.json"),
                cline: join(home, ".cline", "data", "settings", "cline_mcp_settings.json"),
                windsurf: join(home, ".codeium", "windsurf", "mcp_config.json"),
                copilot: join(home, "Library", "Application Support", "Code", "User", "mcp.json"),
            };
            mkdirSync(join(dir, "proj"), { recursive: true });
            for (const [client, cfgPath] of Object.entries(configPaths)) {
                // an existing unrelated config for each client
                mkdirSync(join(cfgPath, ".."), { recursive: true });
                if (client === "opencode") {
                    writeFileSync(cfgPath, JSON.stringify({ mcp: { github: { type: "local", command: ["gh"] } } }, null, 2));
                } else if (client === "copilot") {
                    // VS Code's unified user mcp.json shape: servers map + inputs
                    writeFileSync(cfgPath, JSON.stringify({ servers: { squeez: { command: "npx", args: ["-y", "squeez", "mcp"] } }, inputs: [] }, null, 2));
                } else {
                    writeFileSync(cfgPath, JSON.stringify({ mcpServers: { other: { command: "other" } } }, null, 2));
                }
                const outcome = registerClient(client, { root: join(dir, "proj"), home });
                assert.equal(outcome.changed, true, `${client} should register`);
                assert.ok(outcome.message.includes('added "kanbn'), client);
            }

            const opencodeConfig = readJsonLoose(configPaths.opencode);
            assert.deepEqual(opencodeConfig.config?.mcp, {
                github: { type: "local", command: ["gh"] },
                kanbn: { type: "local", command: ["kanbn-mcp"], enabled: true },
            });

            const claudeConfig = readJsonLoose(configPaths.claude);
            assert.deepEqual(claudeConfig.config?.mcpServers, {
                other: { command: "other" },
                kanbn: { command: "kanbn-mcp", args: [] },
            });

            const clineConfig = readJsonLoose(configPaths.cline);
            assert.deepEqual(clineConfig.config?.mcpServers, {
                other: { command: "other" },
                kanbn: { transport: { type: "stdio", command: "kanbn-mcp", args: [""] } },
            });

            const windsurfConfig = readJsonLoose(configPaths.windsurf);
            assert.deepEqual(windsurfConfig.config?.mcpServers, {
                other: { command: "other" },
                kanbn: { command: "kanbn-mcp", args: [] },
            });

            const copilotConfig = readJsonLoose(configPaths.copilot);
            assert.deepEqual(copilotConfig.config?.servers, {
                squeez: { command: "npx", args: ["-y", "squeez", "mcp"] },
                "kanbn-mcp": { command: "kanbn-mcp", type: "stdio" },
            });
            assert.deepEqual(copilotConfig.config?.inputs, []);

            // re-registering never duplicates
            const again = registerClient("opencode", { root: join(dir, "proj"), home });
            assert.equal(again.changed, false);
            assert.match(again.message, /already present/);

            // copilot re-register with same root: idempotent
            const copilotAgain = registerClient("copilot", { root: join(dir, "proj"), home });
            assert.equal(copilotAgain.changed, false);
            assert.match(copilotAgain.message, /already present/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("registerClient prefers the modern ~/.cline config over the legacy globalStorage file", () => {
        const dir = makeTempDir();
        try {
            const home = join(dir, "home");
            const modern = join(home, ".cline", "data", "settings", "cline_mcp_settings.json");
            const legacy = join(home, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json");
            for (const file of [modern, legacy]) {
                mkdirSync(join(file, ".."), { recursive: true });
                writeFileSync(file, JSON.stringify({ mcpServers: { unity: { command: "/usr/bin/unity", args: ["mcp"] } } }, null, 2));
            }
            const outcome = registerClient("cline", { root: dir, home });
            assert.equal(outcome.path, modern);
            // legacy file untouched: no kanbn added there
            const legacyConfig = readJsonLoose(legacy);
            assert.deepEqual(Object.keys(legacyConfig.config?.mcpServers ?? {}), ["unity"]);
            // modern file carries the kanbn entry
            assert.ok("kanbn" in (readJsonLoose(modern).config?.mcpServers ?? {}));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("registerClient creates config files that do not exist yet", () => {
        const dir = makeTempDir();
        try {
            const home = join(dir, "home");
            const outcome = registerClient("windsurf", { root: dir, home });
            assert.equal(existsSync(outcome.path), true);
            const config = readJsonLoose(outcome.path);
            assert.deepEqual(config.config?.mcpServers, { kanbn: { command: "kanbn-mcp", args: [] } });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("unregisterClient removes only the kanbn entry", () => {
        const dir = makeTempDir();
        try {
            const home = join(dir, "home");
            registerClient("opencode", { root: dir, home });
            const configPath = join(home, ".config", "opencode", "opencode.json");
            assert.equal(unregisterClient(configPath, "opencode"), true);
            const config = readJsonLoose(configPath);
            assert.equal(config.config?.mcp, undefined);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("copilot treats an existing kanbn-mcp entry as already present and uninstalls cleanly", () => {
        const dir = makeTempDir();
        try {
            const home = join(dir, "home");
            const mcpPath = join(home, "Library", "Application Support", "Code", "User", "mcp.json");
            mkdirSync(join(mcpPath, ".."), { recursive: true });
            // the shape Copilot users hand-write (and which setup generates)
            writeFileSync(mcpPath, JSON.stringify({
                servers: { "kanbn-mcp": { command: "kanbn-mcp", type: "stdio" }, squeez: { command: "npx" } },
                inputs: [],
            }, null, 2));
            const outcome = registerClient("copilot", { root: join(dir, "proj"), home });
            assert.equal(outcome.changed, false);
            assert.match(outcome.message, /already present/);
            // unregister removes only the kanbn-mcp entry
            assert.equal(unregisterClient(mcpPath, "copilot"), true);
            const after = readJsonLoose(mcpPath);
            assert.deepEqual(Object.keys(after.config?.servers ?? {}), ["squeez"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("copilot unregister refuses to remove a different server on the same id", () => {
        const dir = makeTempDir();
        try {
            const home = join(dir, "home");
            const mcpPath = join(home, "Library", "Application Support", "Code", "User", "mcp.json");
            mkdirSync(join(mcpPath, ".."), { recursive: true });
            writeFileSync(mcpPath, JSON.stringify({ servers: { "kanbn-mcp": { command: "something-else" } } }, null, 2));
            assert.equal(unregisterClient(mcpPath, "copilot"), false);
            const config = readJsonLoose(mcpPath);
            assert.ok("kanbn-mcp" in (config.config?.servers ?? {}));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("known client slugs are the canonical matrix", () => {
        assert.deepEqual(CLIENTS.map((c) => c.client), [
            "opencode",
            "claude",
            "cline",
            "windsurf",
            "copilot",
            "cursor",
            "continue",
            "roo",
            "aider",
            "gemini-cli",
            "codex",
        ]);
        assert.ok(manualInstallText().includes("Any other client"));
    });
});

describe("runSetup end to end", () => {
    test("--dry-run writes nothing and prints the plan", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            const output = await captureStdout(() => runSetup(["setup", dir, "--yes", "--dry-run"], { home }));
            assert.match(output, /would write/i);
            assert.match(output, /AGENTS\.md/);
            assert.equal(existsSync(join(dir, "AGENTS.md")), false);
            // no config anywhere: not in the project, not in the global file
            assert.equal(existsSync(join(dir, ".kanbn", "kanbn-mcp-config.json")), false);
            assert.equal(existsSync(configPath(home)), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("a real run reports every stored location with its role, then re-runs show unchanged files", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            const first = await captureStdout(() => runSetup(["setup", dir, "--yes"], { home }));
            assert.match(first, /Wrote:/);
            assert.match(first, /AGENTS\.md \(universal guidance/);
            assert.match(first, /\.opencode\/skills\/kanbn\/SKILL\.md \(opencode project skill/);
            assert.match(first, /skills\/kanbn\/SKILL\.md \(committed skill/);
            // no stored-manifest line: the config carries no install state
            assert.doesNotMatch(first, /Stored manifest:/);
            // second, idempotent run: no writes, files reported as current
            const second = await captureStdout(() => runSetup(["setup", dir, "--yes"], { home }));
            assert.match(second, /Unchanged \(already current\):/);
            assert.match(second, /AGENTS\.md/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--print emits the canonical body + manual instructions and writes nothing", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            const output = await captureStdout(() => runSetup(["setup", dir, "--print"], { home }));
            assert.match(output, /# Kanbn board guidance/);
            assert.match(output, /Manual install/);
            assert.match(output, /Any other client/);
            assert.equal(existsSync(join(dir, "AGENTS.md")), false);
            assert.equal(existsSync(configPath(home)), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--yes run writes every envelope + global config; re-run is idempotent", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes"], { home });
            const expected = [
                "AGENTS.md",
                ".opencode/skills/kanbn/SKILL.md",
                "CLAUDE.md",
                ".windsurf/rules/kanbn.md",
                ".clinerules/kanbn.md",
                ".cline/skills/kanbn/SKILL.md",
                "skills/kanbn/SKILL.md",
                ".github/skills/kanbn/SKILL.md",
                ".cursor/rules/kanbn.md",
                ".cursor/skills/kanbn/SKILL.md",
                ".continue/rules/kanbn.md",
                ".roo/rules/kanbn.md",
                ".aider/kanbn.md",
                ".gemini/rules/kanbn.md",
                ".codex/rules/kanbn.md",
            ];
            for (const file of expected) {
                assert.equal(existsSync(join(dir, file)), true, `${file} should exist`);
            }
            const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
            assert.equal(agents.split(BLOCK_START).length - 1, 1);
            assert.ok(agents.includes("# Kanbn board guidance"));

            const skill = readFileSync(join(dir, ".opencode", "skills", "kanbn", "SKILL.md"), "utf8");
            assert.ok(skill.startsWith(SKILL_FRONTMATTER));
            assert.ok(skill.includes("kanbn_create_task"));

            const config = readConfig(home);
            assert.ok(config);
            // the config lives in $HOME, and the project directory carries none
            assert.equal(config.answers?.columns.length, 5);
            assert.equal(existsSync(join(dir, ".kanbn", "kanbn-mcp-config.json")), false);
            // the config carries no install state
            assert.equal("written" in (config as object), false);
            assert.equal("registered" in (config as object), false);

            // re-run: answers amend, blocks stay singular
            await runSetup(["setup", dir, "--yes"], { home });
            const agentsAfter = readFileSync(join(dir, "AGENTS.md"), "utf8");
            assert.equal(agentsAfter.split(BLOCK_START).length - 1, 1);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--host=windsurf writes only that envelope", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes", "--host=windsurf"], { home });
            assert.equal(existsSync(join(dir, ".windsurf", "rules", "kanbn.md")), true);
            assert.equal(existsSync(join(dir, "AGENTS.md")), false);
            assert.equal(existsSync(join(dir, "CLAUDE.md")), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--host=copilot writes the workspace skill + AGENTS.md (setup) and global personal skill (install)", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            // setup: writes project-level guidance (AGENTS.md + .github/skills/kanbn/SKILL.md)
            await runSetup(["setup", dir, "--yes", "--host=copilot"], { home });
            assert.equal(existsSync(join(dir, "AGENTS.md")), true);
            const projectSkill = join(dir, ".github", "skills", "kanbn", "SKILL.md");
            assert.equal(existsSync(projectSkill), true);
            assert.ok(readFileSync(projectSkill, "utf8").startsWith(SKILL_FRONTMATTER));
            // no global skill from setup
            const personalSkill = join(home, ".copilot", "skills", "kanbn", "SKILL.md");
            assert.equal(existsSync(personalSkill), false);
            // no other clients' envelopes
            assert.equal(existsSync(join(dir, "CLAUDE.md")), false);
            assert.equal(existsSync(join(dir, ".clinerules")), false);

            // install --host=copilot: writes global personal skill
            await runInstall(["install", dir, "--yes", "--host=copilot"], { home });
            assert.equal(existsSync(personalSkill), true);
            assert.ok(readFileSync(personalSkill, "utf8").startsWith(SKILL_FRONTMATTER));
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("a run without --mcp never registers clients, even when hosts are detected", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            // simulate an installed opencode: its config dir exists in the home dir
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            await runSetup(["setup", dir, "--yes"], { home });
            assert.equal(existsSync(join(dir, "opencode.json")), false);
            assert.equal(existsSync(join(home, ".config", "opencode", "opencode.json")), false);
            assert.ok(readConfig(home));
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("bare --mcp registers every detected client into its own config", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            mkdirSync(join(home, ".claude"), { recursive: true });
            await runInstall(["install", dir, "--yes", "--mcp"], { home });
            // opencode: registered in the home config
            const homeConfig = readJsonLoose(join(home, ".config", "opencode", "opencode.json"));
            assert.deepEqual(homeConfig.config?.mcp.kanbn, { type: "local", command: ["kanbn-mcp"], enabled: true });
            // claude: registered in the home config
            const claudeConfig = readJsonLoose(join(home, ".claude.json"));
            assert.deepEqual(claudeConfig.config?.mcpServers, { kanbn: { command: "kanbn-mcp", args: [] } });
            // both registrations are present; no config file is written into the project
            assert.equal(existsSync(join(dir, ".kanbn", "setup.json")), false);
            assert.equal(existsSync(join(dir, ".kanbn", "kanbn-mcp-config.json")), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("re-running after a client config path moves re-registers and cleans the stale entry", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            // Seed the legacy Cline layout (old globalStorage path) exactly as a
            // 1.2.0 run would have left it: unity preserved + kanbn merged in.
            const legacy = join(home, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json");
            mkdirSync(join(legacy, ".."), { recursive: true });
            writeFileSync(legacy, JSON.stringify({
                mcpServers: {
                    unity: { command: "unity", args: ["mcp"] },
                    kanbn: { transport: { type: "stdio", command: "kanbn-mcp", args: [""] } },
                },
            }, null, 2));
            // First run: only the legacy file exists, so cline registers there.
            await runInstall(["install", dir, "--yes", "--mcp=cline"], { home });
            // Now the user's Cline migrates to the modern ~/.cline layout.
            const modern = join(home, ".cline", "data", "settings", "cline_mcp_settings.json");
            mkdirSync(join(modern, ".."), { recursive: true });
            writeFileSync(modern, JSON.stringify(
                { mcpServers: { unity: { transport: { type: "stdio", command: "unity", args: ["mcp"] } } } },
                null, 2
            ));
            // Second run: the modern path wins; the stale legacy entry is removed.
            await runInstall(["install", dir, "--yes", "--mcp=cline"], { home });
            assert.ok("kanbn" in (readJsonLoose(modern).config?.mcpServers ?? {}));
            const legacyAfter = readJsonLoose(legacy);
            assert.deepEqual(Object.keys(legacyAfter.config?.mcpServers ?? {}), ["unity"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--mcp=opencode registers in the home opencode.json", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runInstall(["install", dir, "--yes", "--mcp=opencode"], { home });
            const configPath = join(home, ".config", "opencode", "opencode.json");
            assert.equal(existsSync(configPath), true);
            const config = readJsonLoose(configPath);
            assert.deepEqual(config.config?.mcp.kanbn, { type: "local", command: ["kanbn-mcp"], enabled: true });
            assert.equal(existsSync(join(dir, "opencode.json")), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--mcp=copilot registers in the VS Code user mcp.json", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runInstall(["install", dir, "--yes", "--mcp=copilot"], { home });
            const mcpPath = join(home, "Library", "Application Support", "Code", "User", "mcp.json");
            assert.equal(existsSync(mcpPath), true);
            const config = readJsonLoose(mcpPath);
            assert.deepEqual(config.config?.servers, {
                "kanbn-mcp": { command: "kanbn-mcp", type: "stdio" },
            });
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("uninstall reverses a real run from the derived target set", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes", "--mcp=opencode"], { home });
            const output = await captureStdout(() => runUninstall(["uninstall", dir], { home }));
            assert.match(output, /Removed:/);
            assert.equal(existsSync(join(dir, "AGENTS.md")), false);
            assert.equal(existsSync(join(dir, ".opencode", "skills", "kanbn", "SKILL.md")), false);
            assert.equal(existsSync(join(dir, ".clinerules", "kanbn.md")), false);
            assert.equal(existsSync(join(dir, ".cline", "skills", "kanbn", "SKILL.md")), false);
            // no config ever lived in the project; the global config survives uninstall
            assert.equal(existsSync(join(dir, ".kanbn", "kanbn-mcp-config.json")), false);
            assert.equal(existsSync(configPath(home)), true);
            assert.match(output, /Configuration left in place: /);
            // project opencode.json is now empty of mcp
            const config = existsSync(join(dir, "opencode.json")) ? readJsonLoose(join(dir, "opencode.json")) : null;
            assert.equal(config?.config?.mcp, undefined);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("uninstall still removes generated guidance after the config is deleted", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes"], { home });
            // Simulate state loss: the config is gone, but the generated files remain.
            rmSync(configPath(home), { force: true });
            const output = await captureStdout(() => runUninstall(["uninstall", dir], { home }));
            assert.match(output, /Removed:/);
            assert.equal(existsSync(join(dir, "AGENTS.md")), false);
            assert.equal(existsSync(join(dir, ".opencode", "skills", "kanbn", "SKILL.md")), false);
            assert.equal(existsSync(join(dir, "skills", "kanbn", "SKILL.md")), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("a second uninstall run is a clean no-op", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes"], { home });
            await captureStdout(() => runUninstall(["uninstall", dir], { home }));
            const second = await captureStdout(() => runUninstall(["uninstall", dir], { home }));
            assert.match(second, /Nothing installed/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("uninstall leaves a hand-edited guidance block in place", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes"], { home });
            const agents = join(dir, "AGENTS.md");
            writeFileSync(agents, readFileSync(agents, "utf8").replace(BLOCK_START, "<!-- tampered -->"));
            const output = await captureStdout(() => runUninstall(["uninstall", dir], { home }));
            assert.match(output, /Left in place:/);
            assert.equal(existsSync(agents), true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--check reports the recomputed guidance targets", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes"], { home });
            const output = await captureStdout(() => runSetup(["setup", dir, "--check"], { home }));
            assert.match(output, /kanbn-mcp setup state/);
            assert.match(output, /guidance targets \(recomputed from the config\):/);
            assert.match(output, /ok .*AGENTS\.md/);
            assert.doesNotMatch(output, /written:/);
            const empty = makeTempDir();
            const emptyHome = makeTempDir();
            try {
                // config is global: a home with no config reports nothing installed
                const none = await captureStdout(() => runSetup(["setup", empty, "--check"], { home: emptyHome }));
                assert.match(none, /Nothing installed/);
            } finally {
                rmSync(empty, { recursive: true, force: true });
                rmSync(emptyHome, { recursive: true, force: true });
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("collectAnswers merges a --json import onto defaults", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            const jsonFile = join(dir, "answers.json");
            writeFileSync(jsonFile, JSON.stringify({ tagStyle: "plain", wipLimits: { "In Progress": 2 } }, null, 2));
            const answers = await collectAnswers({ root: dir, home, yes: false, jsonFile, interactive: false, project: false });
            assert.equal(answers.tagStyle, "plain");
            assert.deepEqual(answers.wipLimits, { "In Progress": 2 });
            assert.equal(answers.columns.length, 5);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("runSetup persists answers that a later --yes run reuses", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            const jsonFile = join(dir, "answers.json");
            writeFileSync(jsonFile, JSON.stringify({ projectName: "My Board", tagStyle: "plain" }, null, 2));
            await runSetup(["setup", dir, "--json", jsonFile], { home });
            await runSetup(["setup", dir, "--yes"], { home });
            const config = readConfig(home);
            assert.equal(config?.answers?.projectName, "My Board");
            assert.equal(config?.answers?.tagStyle, "plain");
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });
});

describe("global config with per-project overrides", () => {
    test("resolution is per-field: defaults <- global answers <- project overrides", () => {
        const config: SetupConfig = {
            schemaVersion: 1,
            answers: { ...defaultAnswers("/global"), projectName: "Global Board", tagStyle: "plain" },
            projects: { "/proj": { tagStyle: "prefixed", enforceTags: true } },
        };
        // global view: project overrides ignored
        const globalView = resolveAnswers("/proj", config);
        assert.equal(globalView.projectName, "Global Board");
        assert.equal(globalView.tagStyle, "plain");
        assert.equal(globalView.enforceTags, false);
        // project view: override wins per field, unset fields inherit
        const projectView = resolveAnswers("/proj", config, { project: true });
        assert.equal(projectView.projectName, "Global Board");
        assert.equal(projectView.tagStyle, "prefixed");
        assert.equal(projectView.enforceTags, true);
        // boardRoot always resolves to the board, never inherited
        assert.equal(projectView.boardRoot, resolve("/proj"));
        // a project with no entry falls back to the global answers
        assert.equal(resolveAnswers("/other", config, { project: true }).tagStyle, "plain");
        // no config at all: the defaults
        assert.equal(resolveAnswers("/bare", null, { project: true }).tagStyle, "prefixed");
    });

    test("projectOverrides stores only differing fields; resetting to the global value clears the override", () => {
        const global = defaultAnswers("/proj");
        const final = { ...global, tagStyle: "plain" as const };
        assert.deepEqual(projectOverrides(global, final), { tagStyle: "plain" });
        assert.deepEqual(projectOverrides(global, { ...final, tagStyle: global.tagStyle }), {});
        assert.deepEqual(projectOverrides(global, global), {});
    });

    test("no-flag setup writes only the global answers; --project writes only its override entry", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            const jsonFile = join(dir, "answers.json");
            writeFileSync(jsonFile, JSON.stringify({ projectName: "Global Board", tagStyle: "prefixed" }, null, 2));
            await runSetup(["setup", dir, "--json", jsonFile], { home });

            const projectJson = join(dir, "project.json");
            writeFileSync(projectJson, JSON.stringify({ tagStyle: "plain" }, null, 2));
            await runSetup(["setup", dir, "--json", projectJson, "--project"], { home });

            const config = readConfig(home);
            assert.ok(config);
            // the --project run did not touch the global answers
            assert.equal(config.answers?.projectName, "Global Board");
            assert.equal(config.answers?.tagStyle, "prefixed");
            // only the differing field became an override, keyed by absolute root
            assert.deepEqual(config.projects?.[resolve(dir)], { tagStyle: "plain" });
            // the project directory itself carries no config file
            assert.equal(existsSync(join(dir, ".kanbn", "kanbn-mcp-config.json")), false);

            // a --project re-run keeps the override (accepting the inherited default)
            await runSetup(["setup", dir, "--yes", "--project"], { home });
            assert.deepEqual(readConfig(home)?.projects?.[resolve(dir)], { tagStyle: "plain" });

            // a no-flag re-run leaves the project section untouched
            await runSetup(["setup", dir, "--yes"], { home });
            const after = readConfig(home);
            assert.equal(after?.answers?.tagStyle, "prefixed");
            assert.deepEqual(after?.projects?.[resolve(dir)], { tagStyle: "plain" });
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--project with no existing config creates only the project entry", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes", "--project"], { home });
            const config = readConfig(home);
            assert.ok(config);
            // no global answers were implicitly written
            assert.equal(config.answers, undefined);
            assert.deepEqual(config.projects?.[resolve(dir)], {});
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("guidance renders from the merged config: project overrides win in the emitted files", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            const jsonFile = join(dir, "answers.json");
            writeFileSync(jsonFile, JSON.stringify({ projectName: "Global Board" }, null, 2));
            await runSetup(["setup", dir, "--json", jsonFile], { home });
            const projectJson = join(dir, "project.json");
            writeFileSync(projectJson, JSON.stringify({ projectName: "Project Board" }, null, 2));
            await runSetup(["setup", dir, "--json", projectJson, "--project"], { home });
            // a no-flag re-run emits guidance from the MERGED answers
            await runSetup(["setup", dir, "--yes"], { home });
            const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
            assert.ok(agents.includes("Project: Project Board"));
            // the global answers stay global
            assert.equal(readConfig(home)?.answers?.projectName, "Global Board");
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("a legacy .kanbn/setup.json is ignored (clean break)", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(dir, ".kanbn"), { recursive: true });
            writeFileSync(
                join(dir, ".kanbn", "setup.json"),
                JSON.stringify({ schemaVersion: 1, answers: { ...defaultAnswers(dir), tagStyle: "plain" } }, null, 2)
            );
            await runSetup(["setup", dir, "--yes"], { home });
            // not read: guidance renders from the defaults, not the legacy file
            const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
            assert.ok(agents.includes("typ:bug"));
            // not rewritten or migrated either
            assert.ok(readFileSync(join(dir, ".kanbn", "setup.json"), "utf8").includes('"plain"'));
            assert.equal(existsSync(configPath(home)), true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });
});

describe("interactive prompt loop", () => {
    /** A scripted runner: canned answers in, every interaction recorded. */
    function scriptedRunner(answers: string[]): { runner: PromptRunner; calls: string[]; display: string[] } {
        const calls: string[] = [];
        const display: string[] = [];
        const queue = [...answers];
        const runner: PromptRunner = {
            ask: async (question) => {
                calls.push(question);
                return queue.shift() ?? "";
            },
            write: (text) => display.push(text),
            note: (text) => display.push(text + "\n"),
        };
        return { runner, calls, display };
    }

    test("display never registers a read - exactly one bare ask() per question (input-swallowing freeze)", async () => {
        // 8 questions; answer each with blank (accept default). If display were
        // routed through ask() (the pre-fix bug) there would be 16 reads, the
        // second one swallowing the user's line while the first hangs.
        const { runner, calls } = scriptedRunner(["", "", "", "", "", "", "", ""]);
        const result = await promptLoop(runner, defaultAnswers("/tmp/proj"));
        assert.equal(calls.length, 8);
        for (const question of calls) {
            assert.equal(question, "", "ask() must only ever read input, never display text");
        }
        assert.equal(result.columns.length, 5);
        assert.equal(result.tagStyle, "prefixed");
    });

    test("multi-value questions break before the defaults list, one per indented line", async () => {
        const { runner, display } = scriptedRunner(["", "", "", "", "", "", "", ""]);
        await promptLoop(runner, defaultAnswers("/tmp/proj"));
        const shown = display.join("");
        // the columns question ends with a newline, then each default indented
        assert.match(shown, /Board columns as Name=meaning, separated by \| \(blank = keep default\):\n {2}Backlog=queued but not started\n {2}Todo=up next/);
        // no question/default run-on onto one line
        assert.doesNotMatch(shown, /default\): {2}Backlog/);
    });

    test("a valid answer is parsed and an invalid one retries, keeping the default after 3 strikes", async () => {
        const strike = scriptedRunner(["not-a-style", "nope", "still bad", "", "", "", "", ""]);
        const result = await promptLoop(strike.runner, defaultAnswers("/tmp/proj"));
        // the columns prompt rejects 3 malformed answers, then keeps the default
        assert.equal(result.tagStyle, "prefixed");
        assert.equal(result.columns.length, 5);
        // 3 rejected attempts on columns + 1 read per question (8 total)
        assert.equal(strike.calls.length, 8 + 2);

        const custom = scriptedRunner([
            "Backlog=queued|Todo=ready|Doing=work|Done=done", "", "", "plain", "", "", "", "",
        ]);
        const answered = await promptLoop(custom.runner, defaultAnswers("/tmp/proj"));
        assert.equal(answered.columns.length, 4);
        assert.equal(answered.tagStyle, "plain");
    });
});

describe("promptAnswers stream runner", () => {
    /** Guard against a hung prompt: fail the test instead of the suite stalling. */
    function withTimeout<T>(promise: Promise<T>, ms = 2000): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`prompt hung after ${ms}ms`)), ms);
                (timer as { unref?: () => void }).unref?.();
            }),
        ]);
    }

    test("fast/pasted answers are queued, never dropped (mash-Enter freeze)", async () => {
        // Regression: readline emits every 'line' of a data chunk in one tick,
        // but the loop registered its next rl.question() a tick later - so a
        // second Enter in the same read had no listener and was silently
        // dropped, freezing the next prompt on input it had already received.
        const input = new PassThrough();
        const output = new PassThrough();
        output.resume(); // discard the displayed prompt text
        const answers = defaultAnswers("/tmp/proj");

        const pending = promptAnswers(answers, { input, output });
        // all eight answers arrive before the loop could possibly ask for them:
        // blank, blank, blank, "plain" (tag style), then four more blanks
        input.write("\n\n\nplain\n\n\n\n\n");
        const result = await withTimeout(pending);

        assert.equal(result.columns.length, 5);
        assert.equal(result.tagStyle, "plain"); // the queued 4th line lands on the tag-style question
        assert.equal(result.mirrorRelations, answers.mirrorRelations);
    });

    test("EOF mid-question settles the pending read so defaults apply instead of hanging", async () => {
        // Ctrl+D (or a closed pipe) with a question outstanding used to leave
        // the promise unsettled forever.
        const input = new PassThrough();
        const output = new PassThrough();
        output.resume();

        const pending = promptAnswers(defaultAnswers("/tmp/proj"), { input, output });
        input.write("\n"); // answer the columns question only
        input.end(); // ...then EOF

        const result = await withTimeout(pending);
        assert.equal(result.columns.length, 5);
        assert.equal(result.tagStyle, "prefixed");
    });
});

describe("install/uninstall --host targeting", () => {
    test("install with no flags targets all detected hosts (MCP + global skills)", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            mkdirSync(join(home, ".claude"), { recursive: true });
            await runInstall(["install", dir, "--yes"], { home });
            // opencode: registered in home config
            const homeConfig = readJsonLoose(join(home, ".config", "opencode", "opencode.json"));
            assert.deepEqual(homeConfig.config?.mcp.kanbn, { type: "local", command: ["kanbn-mcp"], enabled: true });
            // claude: registered in home config
            const claudeConfig = readJsonLoose(join(home, ".claude.json"));
            assert.deepEqual(claudeConfig.config?.mcpServers, { kanbn: { command: "kanbn-mcp", args: [] } });
            // global skills for both
            assert.ok(existsSync(join(home, ".config", "opencode", "skills", "kanbn", "SKILL.md")));
            assert.ok(existsSync(join(home, ".claude", "skills", "kanbn", "SKILL.md")));
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("install --host=opencode targets only opencode", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            mkdirSync(join(home, ".claude"), { recursive: true });
            await runInstall(["install", dir, "--yes", "--host=opencode"], { home });
            // opencode: registered in home config
            const homeConfig = readJsonLoose(join(home, ".config", "opencode", "opencode.json"));
            assert.deepEqual(homeConfig.config?.mcp.kanbn, { type: "local", command: ["kanbn-mcp"], enabled: true });
            // claude: NOT registered
            const claudeConfig = readJsonLoose(join(home, ".claude.json"));
            assert.ok(!("kanbn" in (claudeConfig.config?.mcpServers ?? {})));
            // global skills only for opencode
            assert.ok(existsSync(join(home, ".config", "opencode", "skills", "kanbn", "SKILL.md")));
            assert.ok(!existsSync(join(home, ".claude", "skills", "kanbn", "SKILL.md")));
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("install --host=opencode,claude targets multiple hosts", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            mkdirSync(join(home, ".claude"), { recursive: true });
            await runInstall(["install", dir, "--yes", "--host=opencode,claude"], { home });
            const homeConfig = readJsonLoose(join(home, ".config", "opencode", "opencode.json"));
            assert.deepEqual(homeConfig.config?.mcp.kanbn, { type: "local", command: ["kanbn-mcp"], enabled: true });
            const claudeConfig = readJsonLoose(join(home, ".claude.json"));
            assert.deepEqual(claudeConfig.config?.mcpServers, { kanbn: { command: "kanbn-mcp", args: [] } });
            assert.ok(existsSync(join(home, ".config", "opencode", "skills", "kanbn", "SKILL.md")));
            assert.ok(existsSync(join(home, ".claude", "skills", "kanbn", "SKILL.md")));
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("uninstall with no flags removes all hosts entries", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            mkdirSync(join(home, ".claude"), { recursive: true });
            await runInstall(["install", dir, "--yes"], { home });
            const output = await captureStdout(() => runUninstall(["uninstall", dir], { home }));
            assert.match(output, /Removed:/);
            // opencode config cleaned (kanbn entry removed, mcp object may be empty)
            const homeConfig = readJsonLoose(join(home, ".config", "opencode", "opencode.json"));
            assert.ok(!("kanbn" in (homeConfig.config?.mcp ?? {})));
            // claude config cleaned (kanbn entry removed, mcpServers object may be empty)
            const claudeConfig = readJsonLoose(join(home, ".claude.json"));
            assert.ok(!("kanbn" in (claudeConfig.config?.mcpServers ?? {})));
            // global skills removed
            assert.ok(!existsSync(join(home, ".config", "opencode", "skills", "kanbn", "SKILL.md")));
            assert.ok(!existsSync(join(home, ".claude", "skills", "kanbn", "SKILL.md")));
            // no config was written into the project by install, and uninstall created none
            assert.ok(!existsSync(join(dir, ".kanbn", "setup.json")));
            assert.ok(!existsSync(join(dir, ".kanbn", "kanbn-mcp-config.json")));
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("uninstall --host=opencode removes only opencode entries", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            mkdirSync(join(home, ".claude"), { recursive: true });
            await runInstall(["install", dir, "--yes"], { home });
            // uninstall only opencode
            const output = await captureStdout(() => runUninstall(["uninstall", dir, "--host=opencode"], { home }));
            assert.match(output, /Removed:/);
            assert.match(output, /opencode/);
            // opencode config cleaned
            const homeConfig = readJsonLoose(join(home, ".config", "opencode", "opencode.json"));
            assert.equal(homeConfig.config?.mcp, undefined);
            // claude config STILL EXISTS
            const claudeConfig = readJsonLoose(join(home, ".claude.json"));
            assert.deepEqual(claudeConfig.config?.mcpServers, { kanbn: { command: "kanbn-mcp", args: [] } });
            // opencode skill removed, claude skill remains
            assert.ok(!existsSync(join(home, ".config", "opencode", "skills", "kanbn", "SKILL.md")));
            assert.ok(existsSync(join(home, ".claude", "skills", "kanbn", "SKILL.md")));
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("uninstall --host=opencode,claude removes multiple hosts", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            mkdirSync(join(home, ".claude"), { recursive: true });
            await runInstall(["install", dir, "--yes"], { home });
            const output = await captureStdout(() => runUninstall(["uninstall", dir, "--host=opencode,claude"], { home }));
            assert.match(output, /Removed:/);
            // both configs cleaned (kanbn entries removed)
            const homeConfig = readJsonLoose(join(home, ".config", "opencode", "opencode.json"));
            assert.ok(!("kanbn" in (homeConfig.config?.mcp ?? {})));
            const claudeConfig = readJsonLoose(join(home, ".claude.json"));
            assert.ok(!("kanbn" in (claudeConfig.config?.mcpServers ?? {})));
            // both skills removed
            assert.ok(!existsSync(join(home, ".config", "opencode", "skills", "kanbn", "SKILL.md")));
            assert.ok(!existsSync(join(home, ".claude", "skills", "kanbn", "SKILL.md")));
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("uninstall --host=unknown-host errors appropriately", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            await runInstall(["install", dir, "--yes", "--host=opencode"], { home });
            // uninstall with unknown host
            let threw = false;
            try {
                await runUninstall(["uninstall", dir, "--host=unknown-host"]);
            } catch (e) {
                threw = true;
                assert.match((e as Error).message, /Unknown host "unknown-host"/);
            }
            assert.ok(threw);
            // opencode config should still exist
            const homeConfig = readJsonLoose(join(home, ".config", "opencode", "opencode.json"));
            assert.deepEqual(homeConfig.config?.mcp.kanbn, { type: "local", command: ["kanbn-mcp"], enabled: true });
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("install --check with no flags reports all detected hosts", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            mkdirSync(join(home, ".claude"), { recursive: true });
            const output = await captureStdout(() => runInstall(["install", dir, "--check"], { home }));
            assert.match(output, /MCP registration/);
            assert.match(output, /opencode/);
            assert.match(output, /claude/);
            assert.match(output, /Global skills/);
            assert.match(output, /opencode/);
            assert.match(output, /claude/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("install --dry-run with no flags plans for all detected hosts", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            mkdirSync(join(home, ".config", "opencode"), { recursive: true });
            mkdirSync(join(home, ".claude"), { recursive: true });
            const output = await captureStdout(() => runInstall(["install", dir, "--dry-run"], { home }));
            assert.match(output, /would register.*opencode/i);
            assert.match(output, /would register.*claude/i);
            assert.match(output, /SKILL\.md.*opencode/i);
            assert.match(output, /SKILL\.md.*claude/i);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });
});