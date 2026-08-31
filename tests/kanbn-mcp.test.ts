import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { describe } from "node:test";

import { buildTaskDataFromArgs, handleToolCall, listTools } from "../server";

const KanbnClass = require("@basementuniverse/kanbn/src/main.js")?.Kanbn;

function makeTempDir(): string {
    return mkdtempSync(path.join(tmpdir(), "kanbn-mcp-"));
}

function getTaskForDir(dir: string, taskId: string) {
    const instance = new KanbnClass(dir);
    return instance.getTask(taskId);
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

            const task = await getTaskForDir(dir, taskIdMatch[1]);

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
                taskId: taskIdMatch[1],
                column: "Done",
            });

            assert.match(moved.content[0].text, /Moved task .* to column "Done"/i);

            const index = await new KanbnClass(dir).getIndex();
            assert.ok(index.columns.Done.includes(taskIdMatch[1]));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
