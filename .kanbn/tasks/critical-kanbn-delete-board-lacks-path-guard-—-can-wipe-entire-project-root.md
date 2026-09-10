---
created: 2026-09-10T04:30:19.006Z
---

# CRITICAL: kanbn_delete_board lacks path guard — can wipe entire project root

## Problem

`handleKanbnDeleteBoard` receives a `boardPath` from `getKanbnPath()`, which resolves to:
1. The user-provided `path` argument
2. `KANBN_DEFAULT_PATH` environment variable
3. `process.cwd()` as a fallback

If `KANBN_DEFAULT_PATH` is misconfigured or unset, and the user calls the tool without providing `path`, the handler defaults to `process.cwd()` — the project root.

The handler then executes:
```ts
fs.rmSync(boardPath, { recursive: true, force: true });
```

This **wipes the entire working directory** with no guard, no confirmation, and no check that the path actually contains a `.kanbn` subfolder.

## Risk

- Catastrophic data loss if env var is wrong or `path` is omitted
- No validation that the target is actually a Kanbn board directory
- The tool schema has no `path` marked as required, so MCP clients can call it with zero arguments

## Acceptance Criteria

- [ ] Guard prevents deletion of any path that does not contain `.kanbn` (or `.kanbn` is the final segment)
- [ ] If `KANBN_DEFAULT_PATH` resolves to a non-board directory, the tool rejects the call with a clear error
- [ ] `path` is added as a required field in the tool schema, forcing the caller to be explicit
- [ ] Unit test covers the happy path (deletes a valid board directory)
- [ ] Unit test covers the guard rejecting deletion of a non-board directory
- [ ] Unit test covers deletion when `KANBN_DEFAULT_PATH` is misconfigured

## Sub-tasks

- [ ] Add path validation: reject if target does not contain '.kanbn'
- [ ] Add unit test for happy path — valid board deletion
- [ ] Add unit test for guard — non-board directory rejection
- [ ] Add unit test for misconfigured KANBN_DEFAULT_PATH

## History

- type: created
  date: 2026-09-10T04:30:19.006Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
