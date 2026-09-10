---
created: 2026-09-10T04:37:04.425Z
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

- [ ] Widen actions type or add JSDoc noting it should be synced with Kanbn library
- [ ] Add verification comment noting type sync responsibility

## History

- type: created
  date: 2026-09-10T04:37:04.425Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
