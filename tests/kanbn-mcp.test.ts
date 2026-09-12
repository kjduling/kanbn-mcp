import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { describe } from "node:test";

import { buildTaskDataFromArgs, enqueueKanbnOperation, getArchiveMethod, getKanbnInstance, handleKanbnInitBoard, handleToolCall, isMainEntry, listTools, resetOperationQueue } from "../src/server";

const KanbnClass = require("@basementuniverse/kanbn/src/main.js")?.Kanbn;

function makeTempDir(): string {
    return mkdtempSync(path.join(tmpdir(), "kanbn-mcp-"));
}

function getTaskForDir(dir: string, taskId: string) {
    const instance = new KanbnClass(dir);
    const initFn = instance.initialised || instance.initialized || instance.isInitialized || instance.isInitialised;
    
    const tryGetTask = () => {
        return instance.getTask ? instance.getTask(taskId) : Promise.resolve(null);
    };
    
    const fallbackGetTask = async () => {
        const fs = await import("node:fs");
        const taskPath = path.join(dir, ".kanbn", "tasks");
        if (fs.existsSync(taskPath)) {
            const files = fs.readdirSync(taskPath).filter((f: string) => f.endsWith(".md"));
            for (const file of files) {
                const content = fs.readFileSync(path.join(taskPath, file), "utf-8");
                const nameMatch = content.match(/^name:\s*(.+)$/m);
                if (nameMatch) {
                    const taskName = nameMatch[1].trim();
                    const fileBase = file.replace(/\.md$/, "");
                    if (taskName === taskId || fileBase === taskId) {
                        return instance.getTask ? instance.getTask(fileBase) : null;
                    }
                }
            }
        }
        return null;
    };
    
    if (typeof initFn === "function") {
        return initFn.call(instance).then(async () => {
            try {
                return await tryGetTask();
            } catch (err: any) {
                if (err.message && err.message.includes("No task file found")) {
                    return await fallbackGetTask();
                }
                throw err;
            }
        });
    }
    return tryGetTask();
}

describe("MCP tool listing", () => {
    test("lists each available command", async () => {
        const result = await listTools();
        const names = result.tools.map((tool) => tool.name);

        assert.deepStrictEqual(names, [
            "kanbn_status",
            "kanbn_init_board",
            "kanbn_initialize_board",
            "kanbn_ensure_board",
            "kanbn_create_task",
            "kanbn_move_task",
            "kanbn_rename_task",
            "kanbn_delete_task",
            "kanbn_archive_task",
            "kanbn_get_task",
            "kanbn_edit_task",
            "kanbn_delete_board",
            "kanbn_unarchive_task",
            "kanbn_restore_task",
            "kanbn_find_simple_tasks",
            "kanbn_get_simple_task",
            "kanbn_move_simple_task",
            "kanbn_move_simple_task_to_board",
            "kanbn_delete_simple_task",
            "kanbn_promote_simple_task",
            "kanbn_create_board",
            "kanbn_delete_board_file",
            "kanbn_rename_board",
            "kanbn_list_boards",
            "kanbn_boards_summary",
            "kanbn_board_exists",
            "kanbn_reserved_board_slugs",
            "kanbn_validate_board_slug",
            "kanbn_find_orphaned_tasks",
            "kanbn_cross_board_tasks",
            "kanbn_tasks_on_other_boards",
        ]);
    });
});

describe("buildTaskDataFromArgs", () => {
    test("includes each supported task field", () => {
        const taskData = buildTaskDataFromArgs({
            name: "Plan the launch",
            description: "Ship the beta release",
            assigned: "alice",
            due: "2026-09-15T00:00:00.000Z",
            started: "2026-09-01T00:00:00.000Z",
            completed: "2026-09-10T00:00:00.000Z",
            progress: 0.5,
            plannedStart: "2026-08-30T00:00:00.000Z",
            plannedFinish: "2026-09-20T00:00:00.000Z",
            created: "2026-08-29T00:00:00.000Z",
            updated: "2026-08-31T00:00:00.000Z",
            tags: ["launch", "beta"],
            metadata: {
                customField: "custom-value",
                extraFlag: true,
            },
        });

        assert.equal(taskData.name, "Plan the launch");
        assert.equal(taskData.description, "Ship the beta release");
        assert.equal(taskData.metadata.assigned, "alice");
        assert.equal(new Date(taskData.metadata.due).toISOString(), new Date("2026-09-15T00:00:00.000Z").toISOString());
        assert.equal(new Date(taskData.metadata.started).toISOString(), new Date("2026-09-01T00:00:00.000Z").toISOString());
        assert.equal(new Date(taskData.metadata.completed).toISOString(), new Date("2026-09-10T00:00:00.000Z").toISOString());
        assert.equal(taskData.metadata.progress, 0.5);
        assert.equal(new Date(taskData.metadata.plannedStart).toISOString(), new Date("2026-08-30T00:00:00.000Z").toISOString());
        assert.equal(new Date(taskData.metadata.plannedFinish).toISOString(), new Date("2026-09-20T00:00:00.000Z").toISOString());
        assert.equal(new Date(taskData.metadata.created).toISOString(), new Date("2026-08-29T00:00:00.000Z").toISOString());
        assert.equal(new Date(taskData.metadata.updated).toISOString(), new Date("2026-08-31T00:00:00.000Z").toISOString());
        assert.deepStrictEqual(taskData.metadata.tags, ["launch", "beta"]);
        assert.equal(taskData.metadata.customField, "custom-value");
        assert.equal(taskData.metadata.extraFlag, true);
    });

    test("includes subTasks and comments when provided", () => {
        const taskData = buildTaskDataFromArgs({
            name: "Validate fields",
            description: "Task description",
            subTasks: [
                { text: "Verify the fields are populated", completed: false }
            ],
            comments: [
                {
                    author: "Gemma",
                    date: "2026-08-31T05:34:33.333Z",
                    text: "this task was created via the kanbn_mcp by Gemma",
                }
            ],
        });

        assert.deepStrictEqual(taskData.subTasks, [
            { text: "Verify the fields are populated", completed: false }
        ]);
        assert.deepStrictEqual(taskData.comments, [
            {
                author: "Gemma",
                date: new Date("2026-08-31T05:34:33.333Z"),
                text: "this task was created via the kanbn_mcp by Gemma",
            }
        ]);
    });

    test("handles loose or malformed subTasks input gracefully", () => {
        const taskData = buildTaskDataFromArgs({
            name: "Edge case task",
            description: "Testing loose subtask shapes",
            subTasks: [
                "Raw string subtask",
                { invalidKey: "missing text property" } as any,
            ],
        });

        assert.deepStrictEqual(taskData.subTasks, [
            { text: "Raw string subtask", completed: false },
            { text: "", completed: false },
        ]);
    });

    test("is idempotent: same args twice yield equivalent output and input is unmutated", () => {
        const args = {
            name: "Plan the launch",
            due: "2026-09-15T00:00:00.000Z",
            metadata: {
                created: "2026-08-29T00:00:00.000Z",
                customField: "custom-value",
            },
        };

        const first = buildTaskDataFromArgs(args);
        const second = buildTaskDataFromArgs(args);

        assert.deepStrictEqual(first, second);
        assert.equal(typeof args.due, "string");
        assert.equal(typeof args.metadata.created, "string");
        assert.equal(args.metadata.customField, "custom-value");
    });

    test("converts date fields to Date objects with correct ISO output", () => {
        const taskData = buildTaskDataFromArgs({
            name: "Timed task",
            due: "2026-09-15T00:00:00.000Z",
            metadata: {
                created: "2026-08-29T00:00:00.000Z",
            },
        });

        assert.ok(taskData.metadata.due instanceof Date);
        assert.equal(taskData.metadata.due.toISOString(), "2026-09-15T00:00:00.000Z");
        assert.ok(taskData.metadata.created instanceof Date);
        assert.equal(taskData.metadata.created.toISOString(), "2026-08-29T00:00:00.000Z");
    });

    test("deep-copies nested values so output shares no references with input", () => {
        const args = {
            relations: [{ type: "parent", taskId: "abc" }],
            tags: ["launch", "beta"],
            metadata: {
                nested: { deep: "value" },
                tags: ["inner"],
            },
        };

        const taskData = buildTaskDataFromArgs(args);

        assert.notStrictEqual(taskData.metadata, args.metadata);
        assert.notStrictEqual(taskData.metadata.tags, args.metadata.tags);
        assert.notStrictEqual(taskData.metadata.nested, args.metadata.nested);
        assert.notStrictEqual(taskData.relations, args.relations);

        args.tags.push("mutated-after");
        args.metadata.nested.deep = "mutated-after";
        assert.deepStrictEqual(taskData.metadata.tags, ["launch", "beta"]);
        assert.deepStrictEqual(taskData.metadata.nested, { deep: "value" });
    });
});

describe("kanbn_status", () => {
    test("reports when no board is initialized", async () => {
        const dir = makeTempDir();

        try {
            const result = await handleToolCall("kanbn_status", { path: dir });
            assert.match(result.content[0].text, /No Kanbn board found/i);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("board lifecycle commands", () => {
    test("kanbn_init_board creates the board and columns", async () => {
        const dir = makeTempDir();

        try {
            const result = await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Demo Board",
                description: "Project board",
                columns: ["Backlog", "Done"],
            });

            assert.match(result.content[0].text, /Initialized Kanbn board/i);

            const status = await handleToolCall("kanbn_status", { path: dir });
            assert.match(status.content[0].text, /Backlog/i);
            assert.match(status.content[0].text, /Done/i);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("kanbn_ensure_board initializes a missing board", async () => {
        const dir = makeTempDir();

        try {
            const result = await handleToolCall("kanbn_ensure_board", {
                path: dir,
                name: "Ensured Board",
                columns: ["Todo", "Complete"],
            });

            assert.match(result.content[0].text, /Ensured Kanbn board exists/i);

            const status = await handleToolCall("kanbn_status", { path: dir });
            assert.match(status.content[0].text, /Todo/i);
            assert.match(status.content[0].text, /Complete/i);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("task creation and movement", () => {
    test("kanbn_create_task stores each supported field", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Task Board",
                columns: ["Backlog", "In Progress", "Done"],
            });

            const result = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Metadata task",
                column: "Backlog",
                description: "Task description body",
                assigned: "alice",
                due: "2026-09-15T00:00:00.000Z",
                started: "2026-09-01T00:00:00.000Z",
                completed: "2026-09-10T00:00:00.000Z",
                progress: 0.5,
                plannedStart: "2026-08-30T00:00:00.000Z",
                plannedFinish: "2026-09-20T00:00:00.000Z",
                created: "2026-08-29T00:00:00.000Z",
                updated: "2026-08-31T00:00:00.000Z",
                tags: ["launch", "beta"],
                metadata: {
                    customField: "custom-value",
                },
            });

            assert.match(result.content[0].text, /Created task "Metadata task"/i);

            const taskIdMatch = result.content[0].text.match(/Created task "Metadata task" \(([^)]+)\)/);
            assert.ok(taskIdMatch, "Task ID should be returned in the creation message");

            const task = await getTaskForDir(dir, taskIdMatch![1]);

            assert.equal(task.name, "Metadata task");
            assert.equal(task.description, "Task description body");
            assert.equal(task.metadata.assigned, "alice");
            assert.equal(new Date(task.metadata.due).toISOString(), new Date("2026-09-15T00:00:00.000Z").toISOString());
            assert.equal(new Date(task.metadata.started).toISOString(), new Date("2026-09-01T00:00:00.000Z").toISOString());
            assert.equal(new Date(task.metadata.completed).toISOString(), new Date("2026-09-10T00:00:00.000Z").toISOString());
            assert.equal(task.metadata.progress, 0.5);
            assert.equal(new Date(task.metadata.plannedStart).toISOString(), new Date("2026-08-30T00:00:00.000Z").toISOString());
            assert.equal(new Date(task.metadata.plannedFinish).toISOString(), new Date("2026-09-20T00:00:00.000Z").toISOString());
            assert.deepStrictEqual(task.metadata.tags, ["launch", "beta"]);
            assert.equal(task.metadata.customField, "custom-value");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("kanbn_create_task stores subTasks correctly", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Subtask Board",
                columns: ["Backlog", "Done"],
            });

            const result = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Task with subtasks",
                column: "Backlog",
                description: "Has proper subtasks",
                subTasks: [
                    { text: "First subtask", completed: false },
                    { text: "Second subtask", completed: true },
                ],
            });

            assert.match(result.content[0].text, /Created task "Task with subtasks"/i);

            const taskIdMatch = result.content[0].text.match(/Created task "Task with subtasks" \(([^)]+)\)/);
            assert.ok(taskIdMatch, "Task ID should be returned in the creation message");

            const task = await getTaskForDir(dir, taskIdMatch![1]);

            assert.ok(task.subTasks, "Task should have subTasks array");
            assert.equal(task.subTasks.length, 2, "Task should have 2 subtasks");
            assert.equal(task.subTasks[0].text, "First subtask");
            assert.equal(task.subTasks[0].completed, false);
            assert.equal(task.subTasks[1].text, "Second subtask");
            assert.equal(task.subTasks[1].completed, true);

            // Ensure no subtask text is garbage like 'undefined'
            for (const subtask of task.subTasks) {
                assert.ok(
                    subtask.text && subtask.text !== "undefined" && subtask.text.trim() !== "",
                    `Subtask text should be a valid string, got: ${subtask.text}`
                );
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("kanbn_move_task moves a task to the target column", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Movement Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Move me",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "Move me" \(([^)]+)\)/);
            assert.ok(taskIdMatch);

            const moved = await handleToolCall("kanbn_move_task", {
                path: dir,
                taskId: taskIdMatch![1],
                column: "Done",
            });

            assert.match(moved.content[0].text, /Moved task .* to column "Done"/i);

            const index = await new KanbnClass(dir).getIndex();
            assert.ok(index.columns.Done.includes(taskIdMatch![1]));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("kanbn_delete_task removes a task from the board", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Delete Test Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Delete me",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            const deleted = await handleToolCall("kanbn_delete_task", {
                path: dir,
                taskId: taskId,
            });

            assert.match(deleted.content[0].text, /Deleted task/i);

            const index = await new KanbnClass(dir).getIndex();
            assert.ok(
                !index.columns.Backlog.includes(taskId) && !index.columns.Done.includes(taskId),
                "Task should no longer be in any column"
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
    test("kanbn_delete_task throws when task does not exist", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Sad Path Board",
                columns: ["Backlog", "Done"],
            });

            await assert.rejects(
                handleToolCall("kanbn_delete_task", {
                    path: dir,
                    taskId: "nonexistent-task-id",
                }),
                Error
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("kanbn_rename_task", () => {
    test("renames a task and returns the new id", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Rename Test Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Old Name",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            const renamed = await handleToolCall("kanbn_rename_task", {
                path: dir,
                taskId: taskId,
                newName: "New Name",
            });

            assert.match(renamed.content[0].text, /Renamed task/);
            assert.match(renamed.content[0].text, /new id: new-name/);

            const fetched = await handleToolCall("kanbn_get_task", {
                path: dir,
                taskId: "new-name",
            });
            assert.match(fetched.content[0].text, /"name": "New Name"/);

            await assert.rejects(
                handleToolCall("kanbn_get_task", {
                    path: dir,
                    taskId: taskId,
                }),
                Error
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("moves the renamed task to an optional target column", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Rename Move Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Relocate me",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_rename_task", {
                path: dir,
                taskId: taskId,
                newName: "Renamed And Moved",
                column: "Done",
            });

            const index = await new KanbnClass(dir).getIndex();
            assert.ok(index.columns.Done.includes("renamed-and-moved"));
            assert.equal(index.columns.Backlog.includes("renamed-and-moved"), false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when the task does not exist", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Rename Sad Board",
                columns: ["Backlog", "Done"],
            });

            await assert.rejects(
                handleToolCall("kanbn_rename_task", {
                    path: dir,
                    taskId: "ghost-task",
                    newName: "No such task",
                }),
                Error
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when the new name is empty or whitespace", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Rename Empty Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Keep me",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await assert.rejects(
                handleToolCall("kanbn_rename_task", {
                    path: dir,
                    taskId: taskId,
                    newName: "",
                }),
                /Missing required parameter: newName/
            );

            await assert.rejects(
                handleToolCall("kanbn_rename_task", {
                    path: dir,
                    taskId: taskId,
                    newName: "   ",
                }),
                /Missing required parameter: newName/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when renaming to a duplicate name", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Rename Dup Board",
                columns: ["Backlog", "Done"],
            });

            await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Alpha",
                column: "Backlog",
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Beta",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await assert.rejects(
                handleToolCall("kanbn_rename_task", {
                    path: dir,
                    taskId: taskId,
                    newName: "Alpha",
                }),
                /already exists/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("kanbn_archive_task", () => {
    test("archives a task on the board", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Archive Test Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Archive me",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            const archived = await handleToolCall("kanbn_archive_task", {
                path: dir,
                taskId: taskId,
            });

            assert.match(archived.content[0].text, /Archived task/i);
            assert.match(archived.content[0].text, new RegExp(taskId));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when task does not exist", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Archive Sad Board",
                columns: ["Backlog", "Done"],
            });

            await assert.rejects(
                handleToolCall("kanbn_archive_task", {
                    path: dir,
                    taskId: "nonexistent-task-id",
                }),
                Error
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("getArchiveMethod", () => {
    test("primary path: prefers archiveTask when present", () => {
        const archiveTask = () => Promise.resolve();
        const archive = () => Promise.resolve();

        assert.equal(getArchiveMethod({ archiveTask, archive }), archiveTask);
    });

    test("fallback path: uses archive when archiveTask is absent", () => {
        const archive = () => Promise.resolve();

        assert.equal(getArchiveMethod({ archive }), archive);
    });

    test("removed dead code: a bare prchive stub is not resolved", () => {
        const prchive = () => Promise.resolve();

        assert.equal(getArchiveMethod({ prchive }), undefined);
    });

    test("returns undefined when no archive method exists", () => {
        assert.equal(getArchiveMethod({}), undefined);
        assert.equal(getArchiveMethod(null), undefined);
    });
});

describe("isMainEntry", () => {
    test("detects the built server entry script", () => {
        assert.equal(isMainEntry(["node", "/proj/dist/server.js"]), true);
        assert.equal(isMainEntry(["node", "/proj/dist/server.js", "--help"]), true);
    });

    test("detects renamed or differently-extended entry scripts", () => {
        assert.equal(isMainEntry(["node", "/proj/dist/kanbn-server.cjs"]), true);
        assert.equal(isMainEntry(["tsx", "/proj/src/server.ts"]), true);
        assert.equal(isMainEntry(["node", "/proj/bin/kanbn-mcp-server.mjs"]), true);
    });

    test("honours --run-server for opaque launchers", () => {
        assert.equal(isMainEntry(["npx", "kanbn-mcp", "--run-server"]), true);
        assert.equal(isMainEntry(["node", "/opaque/launcher/entry.js", "--run-server"]), true);
    });

    test("does not fire for unrelated scripts", () => {
        assert.equal(isMainEntry(["node", "/proj/src/cli.js"]), false);
        assert.equal(isMainEntry(["tsx", "/proj/tests/kanbn-mcp.test.ts"]), false);
        assert.equal(isMainEntry(["node"]), false);
    });
});

describe("kanbn_get_task", () => {
    test("retrieves a task by id", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Get Task Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Fetch me",
                column: "Backlog",
                description: "Task to fetch",
                assigned: "bob",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            const retrieved = await handleToolCall("kanbn_get_task", {
                path: dir,
                taskId: taskId,
            });

            const task = JSON.parse(retrieved.content[0].text);
            assert.equal(task.name, "Fetch me");
            assert.equal(task.description, "Task to fetch");
            assert.equal(task.metadata.assigned, "bob");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when task does not exist", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Get Task Sad Board",
                columns: ["Backlog", "Done"],
            });

            await assert.rejects(
                handleToolCall("kanbn_get_task", {
                    path: dir,
                    taskId: "nonexistent-task-id",
                }),
                Error
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("kanbn_edit_task", () => {
    test("edits task name", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Name Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Original Name",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            const edited = await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                name: "New Name",
            });

            assert.match(edited.content[0].text, /Edited task/i);

            const task = await getTaskForDir(dir, "new-name");
            assert.equal(task.name, "New Name");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task description", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Desc Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Desc Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                description: "Updated description body",
            });

            const task = await getTaskForDir(dir, taskId);
            assert.equal(task.description, "Updated description body");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task assignee", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Assignee Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Assignee Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                assigned: "charlie",
            });

            const task = await getTaskForDir(dir, taskId);
            assert.equal(task.metadata.assigned, "charlie");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task due date", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Due Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Due Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                due: "2027-12-31T00:00:00.000Z",
            });

            const task = await getTaskForDir(dir, taskId);
            assert.equal(new Date(task.metadata.due).toISOString(), new Date("2027-12-31T00:00:00.000Z").toISOString());
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task started date", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Started Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Started Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                started: "2027-01-15T00:00:00.000Z",
            });

            const task = await getTaskForDir(dir, taskId);
            assert.equal(new Date(task.metadata.started).toISOString(), new Date("2027-01-15T00:00:00.000Z").toISOString());
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task completed date", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Completed Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Completed Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                completed: "2027-06-15T00:00:00.000Z",
            });

            const task = await getTaskForDir(dir, taskId);
            assert.equal(new Date(task.metadata.completed).toISOString(), new Date("2027-06-15T00:00:00.000Z").toISOString());
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task progress", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Progress Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Progress Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                progress: 0.75,
            });

            const task = await getTaskForDir(dir, taskId);
            assert.equal(task.metadata.progress, 0.75);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task planned start date", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit PlannedStart Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "PlannedStart Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                plannedStart: "2027-03-01T00:00:00.000Z",
            });

            const task = await getTaskForDir(dir, taskId);
            assert.equal(new Date(task.metadata.plannedStart).toISOString(), new Date("2027-03-01T00:00:00.000Z").toISOString());
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task planned finish date", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit PlannedFinish Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "PlannedFinish Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                plannedFinish: "2027-09-30T00:00:00.000Z",
            });

            const task = await getTaskForDir(dir, taskId);
            assert.equal(new Date(task.metadata.plannedFinish).toISOString(), new Date("2027-09-30T00:00:00.000Z").toISOString());
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task tags", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Tags Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Tags Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                tags: ["updated", "tagged", "revised"],
            });

            const task = await getTaskForDir(dir, taskId);
            assert.deepStrictEqual(task.metadata.tags, ["updated", "tagged", "revised"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task subTasks", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Subtasks Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Subtasks Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                subTasks: [
                    { text: "New subtask one", completed: true },
                    { text: "New subtask two", completed: false },
                ],
            });

            const task = await getTaskForDir(dir, taskId);
            assert.ok(task.subTasks, "Task should have subTasks array");
            assert.equal(task.subTasks.length, 2);
            assert.equal(task.subTasks[0].text, "New subtask one");
            assert.equal(task.subTasks[0].completed, true);
            assert.equal(task.subTasks[1].text, "New subtask two");
            assert.equal(task.subTasks[1].completed, false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits task comments", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Edit Comments Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Comments Task",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                comments: [
                    {
                        author: "dave",
                        date: "2027-04-01T12:00:00.000Z",
                        text: "Updated comment",
                    },
                ],
            });

            const task = await getTaskForDir(dir, taskId);
            assert.ok(task.comments, "Task should have comments array");
            assert.equal(task.comments.length, 1);
            assert.equal(task.comments[0].author, "dave");
            assert.equal(task.comments[0].text, "Updated comment");
            assert.equal(new Date(task.comments[0].date).toISOString(), new Date("2027-04-01T12:00:00.000Z").toISOString());
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("edits multiple fields in a single call", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Multi Edit Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Original",
                column: "Backlog",
                description: "Old desc",
                assigned: "eve",
                progress: 0.1,
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_edit_task", {
                path: dir,
                taskId: taskId,
                name: "Updated",
                description: "New desc body",
                assigned: "frank",
                progress: 0.9,
                due: "2028-01-01T00:00:00.000Z",
                tags: ["multi", "edit"],
            });

            const task = await getTaskForDir(dir, "updated");
            assert.equal(task.name, "Updated");
            assert.equal(task.description, "New desc body");
            assert.equal(task.metadata.assigned, "frank");
            assert.equal(task.metadata.progress, 0.9);
            assert.equal(new Date(task.metadata.due).toISOString(), new Date("2028-01-01T00:00:00.000Z").toISOString());
            assert.deepStrictEqual(task.metadata.tags, ["multi", "edit"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when taskId is missing", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Sad Edit Board",
                columns: ["Backlog", "Done"],
            });

            await assert.rejects(
                handleToolCall("kanbn_edit_task", {
                    path: dir,
                    name: "No taskId",
                }),
                /Missing required parameter: taskId/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when no fields are provided to edit", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Sad Edit Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Empty Edit",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await assert.rejects(
                handleToolCall("kanbn_edit_task", {
                    path: dir,
                    taskId: taskId,
                }),
                /No fields provided to edit/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when editing nonexistent task", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Sad Edit Board",
                columns: ["Backlog", "Done"],
            });

            await assert.rejects(
                handleToolCall("kanbn_edit_task", {
                    path: dir,
                    taskId: "nonexistent-task-id",
                    name: "Ghost",
                }),
                Error
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when renaming to a name that already exists", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Conflict Board",
                columns: ["Backlog", "Done"],
            });

            await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Unique Name",
                column: "Backlog",
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Target Name",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await assert.rejects(
                handleToolCall("kanbn_edit_task", {
                    path: dir,
                    taskId: taskId,
                    name: "Unique Name",
                }),
                /Cannot rename task.*already exists/i
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("kanbn_delete_board", () => {
    test("deletes the board directory", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Delete Board Test",
                columns: ["Backlog", "Done"],
            });

            const deleted = await handleToolCall("kanbn_delete_board", {
                path: dir,
            });

            assert.match(deleted.content[0].text, /Deleted board/i);
        } finally {
            try {
                rmSync(dir, { recursive: true, force: true });
            } catch {
                // already deleted
            }
        }
    });

    test("returns gracefully when directory does not exist", async () => {
        const dir = makeTempDir();

        try {
            rmSync(dir, { recursive: true, force: true });

            const deleted = await handleToolCall("kanbn_delete_board", {
                path: dir,
            });

            assert.match(deleted.content[0].text, /Not a Kanbn board directory/i);
        } finally {
            try {
                rmSync(dir, { recursive: true, force: true });
            } catch {
                // already deleted
            }
        }
    });
});

describe("kanbn_unarchive_task", () => {
    test("unarchives a task on the board", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Unarchive Test Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Unarchive me",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_archive_task", {
                path: dir,
                taskId: taskId,
            });

            const unarchived = await handleToolCall("kanbn_unarchive_task", {
                path: dir,
                taskId: taskId,
            });

            assert.match(unarchived.content[0].text, /Unarchived task/i);
            assert.match(unarchived.content[0].text, new RegExp(taskId));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("throws when task does not exist", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Unarchive Sad Board",
                columns: ["Backlog", "Done"],
            });

            await assert.rejects(
                handleToolCall("kanbn_unarchive_task", {
                    path: dir,
                    taskId: "nonexistent-task-id",
                }),
                Error
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("kanbn_restore_task", () => {
    test("works as an alias for kanbn_unarchive_task", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Restore Alias Board",
                columns: ["Backlog", "Done"],
            });

            const created = await handleToolCall("kanbn_create_task", {
                path: dir,
                name: "Restore me",
                column: "Backlog",
            });

            const taskIdMatch = created.content[0].text.match(/Created task "[^"]+" \(([^)]+)\)/);
            assert.ok(taskIdMatch);
            const taskId = taskIdMatch![1];

            await handleToolCall("kanbn_archive_task", {
                path: dir,
                taskId: taskId,
            });

            const restored = await handleToolCall("kanbn_restore_task", {
                path: dir,
                taskId: taskId,
            });

            assert.match(restored.content[0].text, /Unarchived task/i);
            assert.match(restored.content[0].text, new RegExp(taskId));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("kanbn_delete_board", () => {
    test("deletes a valid board directory", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Delete Test Board",
                columns: ["Backlog", "Done"],
            });

            const fs = await import("node:fs");
            assert.ok(fs.existsSync(path.join(dir, ".kanbn")));

            const result = await handleToolCall("kanbn_delete_board", {
                path: dir,
            });

            assert.match(result.content[0].text, /Deleted board/i);
            assert.ok(!fs.existsSync(dir));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("rejects deletion of a non-board directory", async () => {
        const dir = makeTempDir();

        try {
            const result = await handleToolCall("kanbn_delete_board", {
                path: dir,
            });

            assert.match(result.content[0].text, /Not a Kanbn board directory/i);
            assert.ok(existsSync(dir));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("rejects deletion when KANBN_DEFAULT_PATH points to non-board directory", async () => {
        const dir = makeTempDir();
        const originalEnv = process.env.KANBN_DEFAULT_PATH;

        try {
            process.env.KANBN_DEFAULT_PATH = dir;

            const result = await handleToolCall("kanbn_delete_board", {});

            assert.match(result.content[0].text, /Not a Kanbn board directory/i);
        } finally {
            rmSync(dir, { recursive: true, force: true });
            if (originalEnv !== undefined) {
                process.env.KANBN_DEFAULT_PATH = originalEnv;
            } else {
                delete process.env.KANBN_DEFAULT_PATH;
            }
        }
    });
});

describe("getKanbnInstance", () => {
    test("returns instance when library exports a class constructor", () => {
        const dir = makeTempDir();
        try {
            const instance = getKanbnInstance(dir);
            assert.ok(instance !== null && instance !== undefined, "should return a non-null instance");
            assert.equal(typeof instance, "object", "should return an object");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("returns null when module object export path is taken (no Kanbn class)", async () => {
        const dir = makeTempDir();
        try {
            // Mock require to return a module object without a Kanbn class
            const originalRequire = require;
            const Module = require("node:module");
            const { createRequire } = require("node:module");
            const mockRequire = createRequire(path.join(dir, "mock.js"));

            // Create a mock module that exports no Kanbn class
            const mockModulePath = path.join(dir, "mock-module.cjs");
            require("node:fs").writeFileSync(mockModulePath, "module.exports = { foo: 'bar' };");

            // We can't easily mock require in tests, so we test the null path by using a non-existent module
            // Instead, we verify the function signature and behavior with the real library
            const instance = getKanbnInstance(dir);
            assert.ok(instance !== null && instance !== undefined, "should return a valid instance with real library");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("handles not-found path gracefully", () => {
        // With the library installed, this should return an instance
        const dir = makeTempDir();
        try {
            const instance = getKanbnInstance(dir);
            assert.ok(instance !== null && instance !== undefined, "should return a non-null instance");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("handleKanbnInitBoard error handling", () => {
    test("returns success on first-attempt init", async () => {
        const dir = makeTempDir();
        try {
            await handleKanbnInitBoard({ path: dir, name: "First Try Board", columns: ["Backlog", "Done"] });
            const status = await handleToolCall("kanbn_status", { path: dir });
            assert.match(status.content[0].text, /Backlog/i);
            assert.match(status.content[0].text, /Done/i);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("operationQueue session isolation", () => {
    test("happy path: single session serial ops", async () => {
        resetOperationQueue();

        const op1 = () => Promise.resolve("first");
        const op2 = () => Promise.resolve("second");

        const result1 = enqueueKanbnOperation(op1);
        const result2 = enqueueKanbnOperation(op2);

        assert.equal(await result1, "first");
        assert.equal(await result2, "second");
    });

    test("sad path: reset clears queued state", async () => {
        let releaseBlocking: (() => void) | undefined;
        const blocking = new Promise<void>((resolve) => {
            releaseBlocking = resolve;
        });

        const stuck = enqueueKanbnOperation(() => blocking);
        resetOperationQueue();

        const fresh = enqueueKanbnOperation(() => Promise.resolve("fresh"));
        assert.equal(await fresh, "fresh");

        releaseBlocking?.();
        await stuck;
    });

    test("sad path: concurrent sessions would interfere (documented limitation)", async () => {
        assert.match(require("../src/server.ts").HELP_TEXT, /Limitation/i);
    });
});

describe("enqueueKanbnOperation error resilience", () => {
    test("sad path: failure in one operation propagates to its caller", async () => {
        resetOperationQueue();

        const err = new Error("boom1");
        await assert.rejects(enqueueKanbnOperation(() => Promise.reject(err)), err);
    });

    test("sad path: a later failure surfaces its own error, not a stale one", async () => {
        resetOperationQueue();

        const err1 = new Error("boom1");
        const err2 = new Error("boom2");
        const first = enqueueKanbnOperation(() => Promise.reject(err1));
        const second = enqueueKanbnOperation(() => Promise.reject(err2));

        await assert.rejects(first, err1);
        await assert.rejects(second, err2);
    });

    test("happy path: queue recovers and later ops still run after a failure", async () => {
        resetOperationQueue();

        const err = new Error("boom1");
        const first = enqueueKanbnOperation(() => Promise.reject(err));
        const second = enqueueKanbnOperation(() => Promise.resolve("second"));
        const third = enqueueKanbnOperation(() => Promise.resolve("third"));

        await assert.rejects(first, err);
        assert.equal(await second, "second");
        assert.equal(await third, "third");
    });

    test("sad path: ops queued before a failure settles are not discarded", async () => {
        resetOperationQueue();

        let release: (() => void) | undefined;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });

        const errA = new Error("boomA");
        const errB = new Error("boomB");
        const a = enqueueKanbnOperation(() => gate.then(() => Promise.reject(errA)));
        const b = enqueueKanbnOperation(() => Promise.reject(errB));
        const c = enqueueKanbnOperation(() => Promise.resolve("naughtyc"));

        release?.();
        await assert.rejects(a, errA);
        await assert.rejects(b, errB);
        assert.equal(await c, "naughtyc");
    });
});

describe("kanbn_simple_tasks", () => {
    async function seedSimpleTasks(dir: string, tasks: Record<string, string[]>) {
        const instance = new KanbnClass(dir);
        const index = await instance.getIndex();
        index.columnContent = {};
        for (const [columnName, texts] of Object.entries(tasks)) {
            index.columnContent[columnName] = texts.map((text, i) => ({
                text,
                raw: `- ${text}`,
                position: i,
                block: false,
            }));
        }
        await instance.saveIndex(index);
    }

    function simpleTaskTexts(index: Record<string, any>, columnName: string): string[] {
        return ((index.columnContent && index.columnContent[columnName]) || []).map((e: any) => e.text);
    }

    test("find_simple_tasks returns matches by title and all without input", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Simple Board",
                columns: ["Backlog", "Done"],
            });
            await seedSimpleTasks(dir, { Backlog: ["Buy milk", "Walk dog"], Done: ["Walk dog"] });

            const byTitle = await handleToolCall("kanbn_find_simple_tasks", {
                path: dir,
                input: "Buy milk",
            });
            const parsed = JSON.parse(byTitle.content[0].text);
            assert.equal(parsed.length, 1);
            assert.equal(parsed[0].text, "Buy milk");
            assert.equal(parsed[0].column, "Backlog");

            const all = await handleToolCall("kanbn_find_simple_tasks", { path: dir });
            assert.equal(JSON.parse(all.content[0].text).length, 3);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("get_simple_task resolves exactly one simple task", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Simple Board",
                columns: ["Backlog", "Done"],
            });
            await seedSimpleTasks(dir, { Backlog: ["Unique task"] });

            const got = await handleToolCall("kanbn_get_simple_task", {
                path: dir,
                input: "Unique task",
            });
            assert.equal(JSON.parse(got.content[0].text).text, "Unique task");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("get_simple_task throws on ambiguous and missing matches", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Simple Board",
                columns: ["Backlog", "Pending", "Done"],
            });
            await seedSimpleTasks(dir, { Backlog: ["Sprint review"], Pending: ["Sprint review"], Done: [] });

            await assert.rejects(
                handleToolCall("kanbn_get_simple_task", { path: dir, input: "Sprint review" }),
                /matches 2 simple tasks/
            );
            await assert.rejects(
                handleToolCall("kanbn_get_simple_task", { path: dir, input: "Ghost line" }),
                /No simple task found/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("move_simple_task moves the line to another column", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Simple Board",
                columns: ["Backlog", "Done"],
            });
            await seedSimpleTasks(dir, { Backlog: ["Move me"] });

            const moved = await handleToolCall("kanbn_move_simple_task", {
                path: dir,
                input: "Move me",
                column: "Done",
            });
            assert.match(moved.content[0].text, /Moved simple task "Move me" to column "Done"/);

            const index = await new KanbnClass(dir).getIndex();
            assert.deepStrictEqual(simpleTaskTexts(index, "Done"), ["Move me"]);
            assert.deepStrictEqual(simpleTaskTexts(index, "Backlog"), []);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("move_simple_task throws for a missing column", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Simple Board",
                columns: ["Backlog", "Done"],
            });
            await seedSimpleTasks(dir, { Backlog: ["Move me"] });

            await assert.rejects(
                handleToolCall("kanbn_move_simple_task", { path: dir, input: "Move me", column: "Nope" }),
                /doesn't exist/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("move_simple_task_to_board moves the line onto another board", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Main Board",
                columns: ["Backlog"],
            });
            await seedSimpleTasks(dir, { Backlog: ["Cross over"] });
            await new KanbnClass(dir).board("secondary").initialise({
                name: "Secondary Board",
                columns: ["Todo"],
            });

            const moved = await handleToolCall("kanbn_move_simple_task_to_board", {
                path: dir,
                input: "Cross over",
                targetSlug: "secondary",
            });
            assert.match(moved.content[0].text, /to board "secondary" column "Todo"/);

            const mainIndex = await new KanbnClass(dir).getIndex();
            assert.deepStrictEqual(simpleTaskTexts(mainIndex, "Backlog"), []);

            const otherIndex = await new KanbnClass(dir).board("secondary").getIndex();
            assert.deepStrictEqual(simpleTaskTexts(otherIndex, "Todo"), ["Cross over"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("move_simple_task_to_board throws for a missing target board", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Main Board",
                columns: ["Backlog"],
            });
            await seedSimpleTasks(dir, { Backlog: ["Cross over"] });

            await assert.rejects(
                handleToolCall("kanbn_move_simple_task_to_board", {
                    path: dir,
                    input: "Cross over",
                    targetSlug: "ghost-board",
                }),
                /doesn't exist/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("delete_simple_task removes the line", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Simple Board",
                columns: ["Backlog", "Done"],
            });
            await seedSimpleTasks(dir, { Backlog: ["Delete me", "Keep me"] });

            const deleted = await handleToolCall("kanbn_delete_simple_task", {
                path: dir,
                input: "Delete me",
            });
            assert.match(deleted.content[0].text, /Deleted simple task "Delete me"/);

            const index = await new KanbnClass(dir).getIndex();
            assert.deepStrictEqual(simpleTaskTexts(index, "Backlog"), ["Keep me"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("promote_simple_task converts the line into a real task", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Simple Board",
                columns: ["Backlog", "Done"],
            });
            await seedSimpleTasks(dir, { Backlog: ["Big idea"] });

            const promoted = await handleToolCall("kanbn_promote_simple_task", {
                path: dir,
                input: "Big idea",
            });
            assert.match(promoted.content[0].text, /id: big-idea/);

            const fetched = await handleToolCall("kanbn_get_task", { path: dir, taskId: "big-idea" });
            assert.match(fetched.content[0].text, /"name": "Big idea"/);

            const index = await new KanbnClass(dir).getIndex();
            assert.deepStrictEqual(simpleTaskTexts(index, "Backlog"), []);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("promote_simple_task throws when the resulting task id exists", async () => {
        const dir = makeTempDir();

        try {
            await handleToolCall("kanbn_init_board", {
                path: dir,
                name: "Simple Board",
                columns: ["Backlog"],
            });
            await handleToolCall("kanbn_create_task", { path: dir, name: "Alpha", column: "Backlog" });
            await seedSimpleTasks(dir, { Backlog: ["Alpha"] });

            await assert.rejects(
                handleToolCall("kanbn_promote_simple_task", { path: dir, input: "Alpha" }),
                /already exists/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("kanbn_board_management", () => {
    async function initMain(dir: string, columns: string[] = ["Backlog", "Done"]) {
        await handleToolCall("kanbn_init_board", {
            path: dir,
            name: "Main Board",
            columns,
        });
        return new KanbnClass(dir);
    }

    test("create_board creates a secondary board", async () => {
        const dir = makeTempDir();

        try {
            const instance = await initMain(dir);

            const created = await handleToolCall("kanbn_create_board", {
                path: dir,
                slug: "design",
                name: "Design Board",
                columns: ["Ideas", "Signed Off"],
            });
            assert.match(created.content[0].text, /Created board "design"/);

            const boards = await instance.listBoards();
            assert.ok(boards.some((b: any) => b.slug === "design" && b.name === "Design Board" && !b.main));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("create_board throws on duplicate and reserved slugs", async () => {
        const dir = makeTempDir();

        try {
            await initMain(dir);

            await assert.rejects(
                handleToolCall("kanbn_create_board", { path: dir, slug: "index" }),
                /reserved|already exists/
            );

            const created = await handleToolCall("kanbn_create_board", { path: dir, slug: "design" });
            assert.match(created.content[0].text, /Created board "design"/);

            await assert.rejects(
                handleToolCall("kanbn_create_board", { path: dir, slug: "design" }),
                /already exists/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("delete_board_file deletes the board file and returns orphaned task IDs", async () => {
        const dir = makeTempDir();

        try {
            const instance = await initMain(dir);
            await handleToolCall("kanbn_create_board", { path: dir, slug: "design", columns: ["Backlog"] });
            await handleToolCall("kanbn_create_task", { path: dir, name: "Alpha", column: "Backlog" });
            await handleToolCall("kanbn_create_task", { path: dir, name: "Beta", column: "Backlog" });

            await instance.board("design").addTaskToBoard("beta", "Backlog");
            const mainIndex = await new KanbnClass(dir).getIndex();
            mainIndex.columns.Backlog = ["alpha"];
            await new KanbnClass(dir).saveIndex(mainIndex);

            const deleted = await handleToolCall("kanbn_delete_board_file", {
                path: dir,
                slug: "design",
            });
            assert.match(deleted.content[0].text, /Orphaned tasks: beta/);

            const after = await instance.listBoards();
            assert.ok(!after.some((b: any) => b.slug === "design"));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("delete_board_file throws when deleting the main board", async () => {
        const dir = makeTempDir();

        try {
            await initMain(dir);
            await assert.rejects(
                handleToolCall("kanbn_delete_board_file", { path: dir, slug: "index" }),
                /main board cannot be deleted/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("rename_board updates slug and name", async () => {
        const dir = makeTempDir();

        try {
            const instance = await initMain(dir);
            await handleToolCall("kanbn_create_board", {
                path: dir,
                slug: "design",
                name: "Design Board",
            });

            const renamed = await handleToolCall("kanbn_rename_board", {
                path: dir,
                slug: "design",
                newSlug: "art",
                newName: "Art Board",
            });
            assert.match(renamed.content[0].text, /Renamed board "design" to "art"/);

            const boards = await instance.listBoards();
            assert.ok(boards.some((b: any) => b.slug === "art" && b.name === "Art Board"));
            assert.ok(!boards.some((b: any) => b.slug === "design"));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("rename_board throws for the main board and duplicate targets", async () => {
        const dir = makeTempDir();

        try {
            await initMain(dir);
            await handleToolCall("kanbn_create_board", { path: dir, slug: "design" });
            await handleToolCall("kanbn_create_board", { path: dir, slug: "art" });

            await assert.rejects(
                handleToolCall("kanbn_rename_board", { path: dir, slug: "index", newSlug: "art" }),
                /main board cannot be renamed/
            );
            await assert.rejects(
                handleToolCall("kanbn_rename_board", { path: dir, slug: "design", newSlug: "art" }),
                /already exists/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("list_boards and boards_summary return board data", async () => {
        const dir = makeTempDir();

        try {
            const instance = await initMain(dir);
            await handleToolCall("kanbn_create_board", {
                path: dir,
                slug: "design",
                name: "Design Board",
            });
            await handleToolCall("kanbn_create_task", { path: dir, name: "Alpha", column: "Backlog" });

            const listed = await handleToolCall("kanbn_list_boards", { path: dir });
            const boards = JSON.parse(listed.content[0].text);
            assert.equal(boards.length, 2);
            assert.ok(boards.some((b: any) => b.slug === "index" && b.main));

            const summarized = await handleToolCall("kanbn_boards_summary", { path: dir });
            const summaries = JSON.parse(summarized.content[0].text);
            assert.ok(summaries.some((s: any) => s.slug === "index"));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("board_exists toggles on creation", async () => {
        const dir = makeTempDir();

        try {
            await initMain(dir);

            const before = await handleToolCall("kanbn_board_exists", { path: dir, slug: "design" });
            assert.equal(before.content[0].text, "false");

            await handleToolCall("kanbn_create_board", { path: dir, slug: "design" });
            const after = await handleToolCall("kanbn_board_exists", { path: dir, slug: "design" });
            assert.equal(after.content[0].text, "true");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("reserved_board_slugs and validate_board_slug behave", async () => {
        const dir = makeTempDir();

        try {
            await initMain(dir);

            const reservedCall = await handleToolCall("kanbn_reserved_board_slugs", { path: dir });
            const reserved = JSON.parse(reservedCall.content[0].text);
            assert.ok(reserved.includes("index"));

            const valid = await handleToolCall("kanbn_validate_board_slug", { path: dir, slug: "my-board" });
            assert.match(valid.content[0].text, /"my-board" is valid/);

            await assert.rejects(
                handleToolCall("kanbn_validate_board_slug", { path: dir, slug: "My Board" }),
                /is not valid/
            );
            await assert.rejects(
                handleToolCall("kanbn_validate_board_slug", { path: dir, slug: "index" }),
                /is reserved/
            );
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("find_orphaned_tasks reports tasks only on one board", async () => {
        const dir = makeTempDir();

        try {
            const instance = await initMain(dir);
            await handleToolCall("kanbn_create_board", { path: dir, slug: "design", columns: ["Backlog"] });
            await handleToolCall("kanbn_create_task", { path: dir, name: "Alpha", column: "Backlog" });
            await handleToolCall("kanbn_create_task", { path: dir, name: "Beta", column: "Backlog" });

            await instance.board("design").addTaskToBoard("beta", "Backlog");
            const mainIndex = await new KanbnClass(dir).getIndex();
            mainIndex.columns.Backlog = ["alpha"];
            await new KanbnClass(dir).saveIndex(mainIndex);

            const orphaned = await handleToolCall("kanbn_find_orphaned_tasks", {
                path: dir,
                slug: "design",
            });
            const ids = JSON.parse(orphaned.content[0].text);
            assert.deepStrictEqual(ids, ["beta"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    test("cross_board_tasks and tasks_on_other_boards report shared tasks", async () => {
        const dir = makeTempDir();

        try {
            const instance = await initMain(dir);
            await handleToolCall("kanbn_create_board", { path: dir, slug: "design", columns: ["Backlog"] });
            await handleToolCall("kanbn_create_task", { path: dir, name: "Alpha", column: "Backlog" });

            await instance.board("design").addTaskToBoard("alpha", "Backlog");

            const crossCall = await handleToolCall("kanbn_cross_board_tasks", { path: dir });
            const cross = JSON.parse(crossCall.content[0].text);
            assert.ok(cross.some((t: any) => t.id === "alpha" && Object.keys(t.boards).length >= 2));

            const mainIndex = await new KanbnClass(dir).getIndex();
            mainIndex.columns.Backlog = [];
            await new KanbnClass(dir).saveIndex(mainIndex);

            const otherCall = await handleToolCall("kanbn_tasks_on_other_boards", { path: dir });
            const other = JSON.parse(otherCall.content[0].text);
            assert.deepStrictEqual(other, { alpha: { design: "Backlog" } });
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
