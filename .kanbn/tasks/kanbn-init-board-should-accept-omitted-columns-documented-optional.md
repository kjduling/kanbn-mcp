---
tags:
  - bug
  - high
created: 2026-10-13T22:38:46.240Z
---

# kanbn_init_board should accept omitted columns (documented optional)

columns is documented as optional in tool schemas but omitting it causes crashes. Root cause: src/tools/board.ts passes undefined explicitly; library dereferences it. Also the positional retry can never work.

Fix: default columns to undefined only when explicitly provided as non-array? Or better, only pass columns if it's an array; otherwise don't pass it so library uses defaults. Also remove/fix the positional retry that masks errors.

## Sub-tasks

- [ ] In handleKanbnInitBoard, only pass columns to init if Array.isArray(args.columns); otherwise omit
- [ ] Remove or fix the positional-retry fallback at line ~99 that passes bare string
- [ ] Add tests: init with no args, name only, columns omitted

## History

- type: created
  date: 2026-10-13T22:38:46.240Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
