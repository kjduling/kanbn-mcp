---
created: 2026-09-07T18:00:58.213Z
updated: 2026-09-07T18:31:43.371Z
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

- [ ] undefined
- [ ] undefined
- [ ] Create a unit test to verify

## History

- type: created
  date: 2026-09-07T18:00:58.213Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
