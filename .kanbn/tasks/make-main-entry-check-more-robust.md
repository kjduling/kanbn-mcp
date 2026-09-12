---
created: 2026-09-07T18:00:58.213Z
updated: 2026-09-12T22:12:41.088Z
completed: 2026-09-12T22:12:41.088Z
---

# Make main() entry check more robust

The `main()` entry check is brittle:

```js
if (process.argv[1]?.endsWith("server.js")) {
```

This won't match if:
- The file is renamed
- The server is run via `npx` or a different launcher
- The file is built to a different output name
- The extension is changed (e.g., .ts via tsx)

**Required fix:**
- Use a more robust check such as `process.argv[1]?.includes("server")` or a dedicated flag like `--watch` or `--run-server`
- Alternatively, always run `main()` by default and remove the check entirely if the server is always intended to run directly
- Document the expected invocation method clearly

## Sub-tasks

- [x] Replace brittle endsWith gate with robust isMainEntry detection
- [x] Document --run-server flag and expected invocation in HELP_TEXT
- [x] Add unit tests for isMainEntry

## Comments

- author: Jinx
  date: 2026-09-12T22:30:00.000Z
  Findings: the endsWith("server.js") gate did not match renamed or differently-extended entries (e.g. server.ts under tsx) or opaque launchers. The always-run option was rejected because tests import the module and auto-starting a stdio server on import would break them. Fix: exported pure isMainEntry(argv) that returns true when argv[1] basename includes "server" (case-insensitive) or the --run-server flag is present, and false when argv[1] is absent. The gate is now if (isMainEntry()). HELP_TEXT documents --run-server and the detection rule. 4 unit tests added. Verified: 63/63 tests pass, tsc clean, and node dist/server.js --version/--help still work.

## History

- type: moved
  date: 2026-09-12T22:12:41.088Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
