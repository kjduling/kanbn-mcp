---
created: 2026-09-07T18:00:58.192Z
updated: 2026-09-07T18:32:46.667Z
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

- [ ] undefined
- [ ] undefined
- [ ] Create a unit test to verify

## History

- type: created
  date: 2026-09-07T18:00:58.192Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
