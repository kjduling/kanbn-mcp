---
assigned: Kevin
created: 2026-09-02T00:40:00.084Z
---

# Simplify task argument mapping

As a developer, I want to remove redundant destructuring of task arguments in the create tool so that the code is cleaner and easier to maintain.

## Sub-tasks

- [ ] Acceptance Test: Verify buildTaskDataFromArgs receives the full args object
- [ ] Acceptance Test: Ensure all metadata fields are correctly mapped

## Comments

- author: Reviewer
  date: 2023-10-27T10:10:00.000Z
  Pass the `args` object directly into `buildTaskDataFromArgs` instead of manually destructuring every field.

## History

- type: created
  date: 2026-09-02T00:40:00.084Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
