---
created: 2026-09-07T18:00:58.192Z
updated: 2026-09-13T18:43:49.211Z
started: 2026-09-13T07:00:00.000Z
completed: 2026-09-13T18:26:10.173Z
column: Done
---

# Improve isBoardInitialized method detection

The `isBoardInitialized` function guesses method names with no fallback logging:

```js
const fn = instance.initialised || instance.initialized || instance.isInitialized || instance.isInitialised;
```

If none of these methods match, it returns `false` without logging or warning. This is silent failure — the caller gets a misleading 'board not initialized' result when the real issue is a method name mismatch.

**Required fix:**
- Add logging (console.warn or similar) when no known method is found
- Consider adding a way to register custom method name mappings
- Document the expected method names in the tool description
- Add a fallback that checks for any function property that looks like an initializer

## Sub-tasks

- [x] Create a unit test to verify

## Comments

- author: Jinx
  date: 2026-09-13T05:15:00.000Z
  isBoardInitialized no longer fails silently on method-name mismatch. Detection order: known names (initialised, initialized, isInitialized, isInitialised) + registered custom names, then a regex fallback (function property ending in 'initialized'/'initialised'). console.warn emitted when nothing matches instead of returning false undetected. Exported registerInitializedMethod() API for custom method names. JSDoc on isBoardInitialized documents the expected method names; kanbn_status and kanbn_ensure_board TOOLS descriptions updated. 6 unit tests: recognized variant without warn; false returned from variant; no-arg throw retried with boardPath; lookalike fallback; no-method returns false with one warn; registered custom name detected. 117/117 pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T18:26:10.173Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T21:48:41.727Z
  fromColumn: Done
  author: Kevin J. Duling
