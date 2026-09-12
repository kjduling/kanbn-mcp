---
created: 2026-09-10T04:30:19.097Z
updated: 2026-09-12T18:11:33.537Z
---

# MEDIUM: operationQueue swallows errors and corrupts subsequent queued operations

## Problem

The task queue in `enqueueKanbnOperation` is designed to serialise Kanbn calls:

```ts
export function enqueueKanbnOperation<T>(op: () => Promise<T>): Promise<T> {
    const result = operationQueue.then(op);
    operationQueue = result.then(
        () => {},
        () => {}   // ← both handlers are no-ops
    );
    return result;
}
```

When `op()` throws:
1. The caller receives the rejection (correct)
2. `operationQueue` is set to `Promise.resolve(undefined)` via the no-op catch
3. **All subsequent queued operations silently continue** as if nothing happened

There is no way to recover — the queue is now a dead chain that discards every future error.

## Risk

- A single failed operation silently corrupts the entire queue
- Subsequent operations appear to succeed but may operate on stale or inconsistent state
- No diagnostic — errors are swallowed at the queue level

## Acceptance Criteria

- [ ] Errors from operations are re-thrown to prevent queue corruption
- [ ] Queue state is preserved (or reset to a known-good state) after an error
- [ ] Unit test verifies that an error in one operation propagates to the caller
- [ ] Unit test verifies that subsequent operations after an error are not silently swallowed

## Sub-tasks

- [ ] Re-throw errors in the result.then() chain to prevent queue corruption
- [ ] Add unit test for error propagation from one operation
- [ ] Add unit test verifying subsequent operations after error

## History

- type: created
  date: 2026-09-10T04:30:19.097Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
- type: moved
  date: 2026-09-12T18:11:33.537Z
  fromColumn: Backlog
  toColumn: Todo
  author: Kevin J. Duling
