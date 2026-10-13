---
tags:
  - feature
  - low
created: 2026-10-13T20:15:25.177Z
updated: 2026-10-13T22:06:15.666Z
---

# Clean up the setup prompt layout - break wordy single-line questions and defaults onto readable lines

The interactive `kanbn-mcp setup` prompts smash the question, the syntax hint, and the default value onto ONE line. For multi-value answers the default is a `|`-joined blob, so the first question is a wall of text:

  Board columns as Name=meaning, separated by | (blank = keep default) [Backlog=queued but not started|Todo=up next, defined and ready to pick up|In Progress=actively being worked|Done=complete and verified|Blocked=waiting on something outside this board]:

That single line is the whole question - wordy enough to be confusing, and the default is unreadable. Wanted: a clearer, multi-line layout.

Rendering lives in src/setup/questions.ts: `askParsed()` builds `${question}${suffix}: ` where suffix is ` [default]` (line ~197), and multi-value defaults come from formatColumns/formatTags/formatWip/formatCustomFields joined with `|`. Interactive output is produced by the PromptRunner (ask/note) in promptAnswers() (line ~308).

Scope: interactive layout ONLY. The `--yes` and `--json` non-interactive paths must stay silent and unchanged, and Enter-to-accept-default / the 3-attempt invalid handling must behave exactly as now.

Sketch of a better layout:
  Board columns - Name=meaning, separated by |
    defaults:
      Backlog = queued but not started
      Todo = up next, defined and ready to pick up
      In Progress = actively being worked
      Done = complete and verified
      Blocked = waiting on something outside this board
  Columns [Enter to keep]:

## Sub-tasks

- [ ] Render each question on its own line with the default value(s) below it, indented; one item per line for multi-value answers (columns, type tags, priority tags, WIP, custom fields)
- [ ] Split the syntax/how-to-answer hint from the question text so the question reads first and the hint reads second
- [ ] Do not smash the default onto the question line; single-value defaults may stay inline, multi-value defaults must break onto their own lines
- [ ] Consider light progress/numbering (e.g. '1/9') only if it stays uncluttered - decide and keep consistent across all prompts
- [ ] Keep Enter-to-accept-default and the 3-attempt invalid-input handling exactly as they are
- [ ] Ensure the non-interactive paths (--yes / --json) render nothing new and are byte-for-byte unaffected
- [ ] Make the layout reachable/testable via the PromptRunner so it can be asserted with a fake runner
- [ ] verify that the first (columns) question no longer renders as one smashed line
- [ ] verify that every multi-value default lists one item per line
- [ ] add a test asserting the rendered prompt layout (question line + indented default items)

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)
- [related-to move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override](move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override.md)
