---
created: 2026-09-10T04:37:04.425Z
updated: 2026-09-13T16:37:09.994Z
completed: 2026-09-13T16:37:09.994Z
column: Done
---

# MINOR: kanbn.d.ts 'actions' option type is overly specific

## Problem

In `kanbn.d.ts`:

```ts
export class Kanbn {
    constructor(root?: any, options?: { board?: string, caches?: any, actions?: boolean });
}
```

The `actions` property is typed as `boolean`, but the actual Kanbn library may accept other types (strings, objects, or `undefined`). This is a lie-by-omission that could mislead TypeScript users.

## Risk

- TypeScript will reject valid values that the library actually accepts
- Users may avoid passing valid options due to type errors
- The type declaration drifts from the actual library API

## Acceptance Criteria

- [ ] `actions` is typed as `boolean | string | object | undefined` or `any` with a comment explaining why
- [ ] A TODO or JSDoc comment notes that the type should be synced with the actual Kanbn library
- [ ] Unit test (or manual verification) confirms the declared types match the library's actual constructor

## Sub-tasks

- [x] Widen actions type or add JSDoc noting it should be synced with Kanbn library
- [x] Add verification comment noting type sync responsibility

## Comments

- author: Jinx
  date: 2026-09-13T03:05:00.000Z
  Widened constructor options actions to boolean | string | Record<string, any> in kanbn.d.ts with a JSDoc comment explaining the runtime only special-cases options.actions === false (strings/objects pass through). TODO note added to re-sync with the lib's own src/main.d.ts when it typifies constructor options. Runtime verification tests confirm the library constructor accepts {}, 'rules.yaml', true and disables only on false. 104/104 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T16:37:09.994Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
- type: archived
  date: 2026-09-13T16:56:04.030Z
  fromColumn: Done
  author: Kevin J. Duling
