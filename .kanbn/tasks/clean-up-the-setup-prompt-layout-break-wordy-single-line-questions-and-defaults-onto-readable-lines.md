---
progress: 1
tags:
  - feature
  - low
created: 2026-10-13T20:15:25.177Z
updated: 2026-10-15T01:02:59.715Z
started: 2026-10-15T00:53:39.644Z
completed: 2026-10-15T01:01:16.344Z
---

# Clean up the setup prompt layout - break wordy single-line questions and defaults onto readable lines

The interactive `kanbn-mcp setup` prompts previously smashed the question, the syntax hint, and the default value onto ONE line. For multi-value answers the default is a `|`-joined blob, so the first question (board columns) was a wall of text:

  Board columns as Name=meaning, separated by | (blank = keep default) [Backlog=queued but not started|Todo=up next, defined and ready to pick up|In Progress=actively being worked|Done=complete and verified|Blocked=waiting on something outside this board]:

That single line is the whole question - wordy enough to be confusing, and the default is unreadable. Wanted: a clearer, multi-line layout.

## Changes Made

Rendering lives in `src/setup/questions.ts`: `askParsed()` now:
- Shows the question on its own line
- Displays multi-value defaults indented below (one per line)
- Keeps single-value defaults inline for cleaner look
- Preserves all existing behavior (Enter-to-accept-default, 3-attempt validation)

### Before vs After

**Before (single line, unreadable):**
```
Board columns as Name=meaning, separated by | (blank = keep default) [Backlog=queued but not started|Todo=up next, defined and ready to pick up|In Progress=actively being worked|Done=complete and verified|Blocked=waiting on something outside this board]: 
```

**After (multi-line, readable):**
```
Board columns as Name=meaning, separated by | (blank = keep default): 
  Backlog=queued but not started
  Todo=up next, defined and ready to pick up
  In Progress=actively being worked
  Done=complete and verified
  Blocked=waiting on something outside this board
```

For single-value defaults like the tag style or mirror relations question, they stay inline:
```
Tag style: prefixed (typ:bug, pri:critical) or plain (bug, critical) [prefixed]: 
```

## Scope

- Interactive layout ONLY - `--yes` and `--json` non-interactive paths remain silent and unchanged
- Enter-to-accept-default behavior preserved
- 3-attempt invalid-input handling unchanged
- All parse functions (`parseColumns`, `parseTags`, etc.) still work identically

## Sub-tasks

- [x] Refactor `askParsed()` to separate question from default value display
- [x] Handle multi-value defaults with `split("|").filter(Boolean)` and indent each line
- [x] Keep single-value defaults inline for cleaner appearance
- [x] Preserve all existing functionality (empty input, invalid input handling)
- [x] Build passes - TypeScript compilation successful
- [x] Move ticket to Done column

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)
- [related-to move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override](move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override.md)

## Comments

- author: Kevin J. Duling
  date: 2026-10-15T00:57:52.614Z
  ✅ Completed: Refactored `askParsed()` in `src/setup/questions.ts` to display multi-line defaults for questions with multiple default values. The board columns question now shows each column as a separate indented line instead of one huge smashed line. Single-value defaults (like tag style) remain inline for cleaner appearance. All existing functionality preserved: Enter-to-accept-default, 3-attempt validation, empty input handling, and non-interactive `--yes`/`--json` paths unchanged.

## History

- type: moved
  date: 2026-10-15T00:53:39.644Z
  fromColumn: Backlog
  toColumn: In Progress
  author: Kevin J. Duling
- type: progress
  date: 2026-10-15T00:53:39.691Z
  fromProgress: 0
  toProgress: 1
  author: Kevin J. Duling
- type: completed
  date: 2026-10-15T01:00:00.000Z
  author: Kevin J. Duling
  description: Refactored askParsed() in src/setup/questions.ts to display multi-line defaults for board columns question. Build passes, all existing functionality preserved.
- type: moved
  date: 2026-10-15T01:01:16.344Z
  fromColumn: In Progress
  toColumn: Done
  author: Kevin J. Duling
