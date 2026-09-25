import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test, { describe, mock } from "node:test";

import {
    findFirstPositional,
    parseSetupArgs,
    runSetup,
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
import { collectAnswers, defaultAnswers, readManifest, skillPlaceholderAnswers, writeManifest } from "../src/setup/questions.js";

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
                "/tmp/proj/skills/kanbn/SKILL.md",
            ]
        );
        const windsurfOnly = planRepoEmit("/tmp/proj", answers, ["windsurf"]);
        assert.deepEqual(windsurfOnly.targets.map((t) => t.path), ["/tmp/proj/.windsurf/rules/kanbn.md"]);
        const opencode = planRepoEmit("/tmp/proj", answers, ["opencode"]);
        assert.deepEqual(
            opencode.targets.map((t) => t.path),
            ["/tmp/proj/AGENTS.md", "/tmp/proj/.opencode/skills/kanbn/SKILL.md"]
        );
    });
});

describe("MCP client registration", () => {
    test("registerClient merges into each client's config shape", () => {
        const dir = makeTempDir();
        try {
            const home = join(dir, "home");
            const configPaths: Record<string, string> = {
                opencode: join(dir, "proj", "opencode.json"),
                claude: join(home, ".claude.json"),
                cline: join(home, ".cline", "data", "settings", "cline_mcp_settings.json"),
                windsurf: join(home, ".codeium", "windsurf", "mcp_config.json"),
            };
            mkdirSync(join(dir, "proj"), { recursive: true });
            for (const [client, cfgPath] of Object.entries(configPaths)) {
                // an existing unrelated config for each client
                mkdirSync(join(cfgPath, ".."), { recursive: true });
                if (client === "opencode") {
                    writeFileSync(cfgPath, JSON.stringify({ mcp: { github: { type: "local", command: ["gh"] } } }, null, 2));
                } else {
                    writeFileSync(cfgPath, JSON.stringify({ mcpServers: { other: { command: "other" } } }, null, 2));
                }
                const outcome = registerClient(client, { root: join(dir, "proj"), home });
                assert.equal(outcome.changed, true, `${client} should register`);
                assert.ok(outcome.message.includes('added "kanbn"'));
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

            // re-registering never duplicates
            const again = registerClient("opencode", { root: join(dir, "proj"), home });
            assert.equal(again.changed, false);
            assert.match(again.message, /already present/);
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
            const configPath = join(dir, "opencode.json");
            assert.equal(unregisterClient(configPath, "opencode"), true);
            const config = readJsonLoose(configPath);
            assert.equal(config.config?.mcp, undefined);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("known client slugs are the canonical matrix", () => {
        assert.deepEqual(CLIENTS.map((c) => c.client), ["opencode", "claude", "cline", "windsurf"]);
        assert.ok(manualInstallText().includes("Any other client"));
    });
});

describe("runSetup end to end", () => {
    test("--dry-run writes nothing and prints the plan", async () => {
        const dir = makeTempDir();
        try {
            const output = await captureStdout(() => runSetup(["setup", dir, "--yes", "--dry-run"]));
            assert.match(output, /would write/);
            assert.match(output, /AGENTS\.md/);
            assert.equal(existsSync(join(dir, "AGENTS.md")), false);
            assert.equal(existsSync(join(dir, ".kanbn", "setup.json")), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("--print emits the canonical body + manual instructions and writes nothing", async () => {
        const dir = makeTempDir();
        try {
            const output = await captureStdout(() => runSetup(["setup", dir, "--print"]));
            assert.match(output, /# Kanbn board guidance/);
            assert.match(output, /Manual install/);
            assert.match(output, /Any other client/);
            assert.equal(existsSync(join(dir, "AGENTS.md")), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("--yes run writes every envelope + manifest; re-run is idempotent", async () => {
        const dir = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes"]);
            const expected = [
                "AGENTS.md",
                ".opencode/skills/kanbn/SKILL.md",
                "CLAUDE.md",
                ".windsurf/rules/kanbn.md",
                ".clinerules/kanbn.md",
                "skills/kanbn/SKILL.md",
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

            const manifest = readManifest(dir);
            assert.ok(manifest);
            assert.equal(manifest.answers.columns.length, 5);
            assert.equal(manifest.written.length, expected.length);

            // re-run: answers amend, blocks stay singular
            await runSetup(["setup", dir, "--yes"]);
            const agentsAfter = readFileSync(join(dir, "AGENTS.md"), "utf8");
            assert.equal(agentsAfter.split(BLOCK_START).length - 1, 1);
            assert.equal(readManifest(dir)?.written.length, expected.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("--host=windsurf writes only that envelope", async () => {
        const dir = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes", "--host=windsurf"]);
            assert.equal(existsSync(join(dir, ".windsurf", "rules", "kanbn.md")), true);
            assert.equal(existsSync(join(dir, "AGENTS.md")), false);
            assert.equal(existsSync(join(dir, "CLAUDE.md")), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
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
            const manifest = readManifest(dir);
            assert.equal(manifest?.registered.length, 0);
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
            await runSetup(["setup", dir, "--yes", "--mcp"], { home });
            // opencode: project config wins (candidate order: project first)
            const projectConfig = readJsonLoose(join(dir, "opencode.json"));
            assert.deepEqual(projectConfig.config?.mcp.kanbn, { type: "local", command: ["kanbn-mcp"], enabled: true });
            // claude: registered in the home config
            const claudeConfig = readJsonLoose(join(home, ".claude.json"));
            assert.deepEqual(claudeConfig.config?.mcpServers, { kanbn: { command: "kanbn-mcp", args: [] } });
            const manifest = readManifest(dir);
            const clients = manifest?.registered.map((r) => r.client).sort();
            assert.deepEqual(clients, ["claude", "opencode"]);
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
            await runSetup(["setup", dir, "--yes", "--mcp=cline"], { home });
            // Now the user's Cline migrates to the modern ~/.cline layout.
            const modern = join(home, ".cline", "data", "settings", "cline_mcp_settings.json");
            mkdirSync(join(modern, ".."), { recursive: true });
            writeFileSync(modern, JSON.stringify(
                { mcpServers: { unity: { transport: { type: "stdio", command: "unity", args: ["mcp"] } } } },
                null, 2
            ));
            // Second run: the modern path wins; the stale legacy entry is removed.
            await runSetup(["setup", dir, "--yes", "--mcp=cline"], { home });
            assert.ok("kanbn" in (readJsonLoose(modern).config?.mcpServers ?? {}));
            const legacyAfter = readJsonLoose(legacy);
            assert.deepEqual(Object.keys(legacyAfter.config?.mcpServers ?? {}), ["unity"]);
            const manifest = readManifest(dir);
            const clineRecord = manifest?.registered.find((r) => r.client === "cline");
            assert.equal(clineRecord?.path, modern);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--mcp=opencode registers in the project opencode.json", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes", "--mcp=opencode"], { home });
            const configPath = join(dir, "opencode.json");
            assert.equal(existsSync(configPath), true);
            const config = readJsonLoose(configPath);
            assert.deepEqual(config.config?.mcp.kanbn, { type: "local", command: ["kanbn-mcp"], enabled: true });
            assert.equal(existsSync(join(home, ".config", "opencode")), false);
            const manifest = readManifest(dir);
            assert.equal(manifest?.registered.length, 1);
            assert.equal(manifest?.registered[0].client, "opencode");
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("uninstall reverses a real run via the manifest", async () => {
        const dir = makeTempDir();
        const home = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes", "--mcp=opencode"], { home });
            const output = await captureStdout(() => runUninstall(["uninstall", dir]));
            assert.match(output, /Removed:/);
            assert.equal(existsSync(join(dir, "AGENTS.md")), false);
            assert.equal(existsSync(join(dir, ".opencode", "skills", "kanbn", "SKILL.md")), false);
            assert.equal(existsSync(join(dir, ".clinerules", "kanbn.md")), false);
            assert.equal(existsSync(join(dir, ".kanbn", "setup.json")), false);
            // project opencode.json is now empty of mcp
            const config = existsSync(join(dir, "opencode.json")) ? readJsonLoose(join(dir, "opencode.json")) : null;
            assert.equal(config?.config?.mcp, undefined);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            rmSync(home, { recursive: true, force: true });
        }
    });

    test("--check reports the installed state", async () => {
        const dir = makeTempDir();
        try {
            await runSetup(["setup", dir, "--yes"]);
            const output = await captureStdout(() => runSetup(["setup", dir, "--check"]));
            assert.match(output, /kanbn-mcp setup state/);
            assert.match(output, /written: 6/);
            const empty = makeTempDir();
            try {
                const none = await captureStdout(() => runSetup(["setup", empty, "--check"]));
                assert.match(none, /Nothing installed/);
            } finally {
                rmSync(empty, { recursive: true, force: true });
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("collectAnswers merges a --json import onto defaults", async () => {
        const dir = makeTempDir();
        try {
            const jsonFile = join(dir, "answers.json");
            writeFileSync(jsonFile, JSON.stringify({ tagStyle: "plain", wipLimits: { "In Progress": 2 } }, null, 2));
            const answers = await collectAnswers({ root: dir, yes: false, jsonFile, interactive: false });
            assert.equal(answers.tagStyle, "plain");
            assert.deepEqual(answers.wipLimits, { "In Progress": 2 });
            assert.equal(answers.columns.length, 5);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("runSetup persists answers that a later --yes run reuses", async () => {
        const dir = makeTempDir();
        try {
            const jsonFile = join(dir, "answers.json");
            writeFileSync(jsonFile, JSON.stringify({ projectName: "My Board", tagStyle: "plain" }, null, 2));
            await runSetup(["setup", dir, "--json", jsonFile]);
            await runSetup(["setup", dir, "--yes"]);
            const manifest = readManifest(dir);
            assert.equal(manifest?.answers.projectName, "My Board");
            assert.equal(manifest?.answers.tagStyle, "plain");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});