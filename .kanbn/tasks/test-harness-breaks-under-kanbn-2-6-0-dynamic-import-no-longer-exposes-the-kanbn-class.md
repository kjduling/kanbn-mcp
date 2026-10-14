---
progress: 1
tags:
  - bug
  - high
created: 2026-10-14T03:35:06.308Z
updated: 2026-10-14T03:35:06.459Z
completed: 2026-10-14T03:35:06.343Z
---

# Test harness breaks under kanbn 2.6.0: dynamic import no longer exposes the Kanbn class

After `npm upgrade` pulled @basementuniverse/kanbn 2.6.0, `npm test` fails with `TypeError: Kanbn is not a constructor` in two tests in tests/kanbn-mcp.test.ts ("throws actionable error when task file is unparseable" and "...invalid front matter"). Cause: kanbn 2.6.0 replaced the eager `module.exports.Kanbn = require('./src/main').Kanbn` assignment with a lazy `Object.defineProperty(module.exports, 'Kanbn', { get() {...} })`. cjs-module-lexer cannot statically detect a getter, so `const { Kanbn } = await import('@basementuniverse/kanbn')` now yields `undefined`. Production is unaffected: src/kanbn/instance.ts resolves the class via `require('@basementuniverse/kanbn/src/main.js')` first. Fix: the two tests now use the module-level `KanbnClass` (already `require('@basementuniverse/kanbn/src/main.js')?.Kanbn`) instead of the dynamic import, matching the resolver production uses.

## Sub-tasks

- [x] Reproduce: run npm test and observe 'Kanbn is not a constructor' in the two unparseable-task tests
- [x] Fix the two tests to resolve the Kanbn class via the module-level KanbnClass (require('@basementuniverse/kanbn/src/main.js')?.Kanbn) instead of dynamic import of the package root
- [x] Confirm the two tests now execute their assert.rejects assertions rather than dying in setup
- [x] Run the full suite green: npm test exits 0 (270/270)
- [x] acceptance: verify `npm test` exits 0 with 0 failing tests on the installed kanbn 2.6.0
- [x] unit test: the two unparseable-task tests fail with a TypeError before the fix and pass after

## History

- type: created
  date: 2026-10-14T03:35:06.308Z
  column: Backlog
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
- type: moved
  date: 2026-10-14T03:35:06.343Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
