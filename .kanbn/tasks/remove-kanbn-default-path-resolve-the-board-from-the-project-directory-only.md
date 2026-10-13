---
tags:
  - bug
  - high
created: 2026-10-13T20:08:55.866Z
updated: 2026-10-13T22:01:04.123Z
---

# Remove KANBN_DEFAULT_PATH; resolve the board from the project directory only

KANBN_DEFAULT_PATH is an ambient environment override that silently redirects EVERY board operation to a fixed path, regardless of the project the host actually opened. It is dangerous: it has already caused tickets to be written to the wrong board. Remove it.

Desired resolution (getKanbnPath, src/kanbn/instance.ts): explicit per-call `path` argument -> process.cwd(). The board is always the project directory the server is launched in; the per-call `path` stays as the only explicit override. No ambient env var.

Why it bites: MCP hosts launch the server with the project as cwd, so cwd already IS the project directory. KANBN_DEFAULT_PATH was added as a "pin a fixed board" escape hatch (see the now-obsolete docs ticket 'docs-kanbn-default-path-is-optional...'), but it wins over cwd and has no scoping, so one stale value in a client config silently misroutes every write from every project.

Still-set variable (decided 2026-10-13): warn LOUDLY - one clear line on stderr naming the ignored variable and the board actually used - so a stale client config cannot silently misroute. Resolution must NOT change: the variable is ignored, not honoured.

Also touches: HELP_TEXT ENVIRONMENT block + client config examples (src/server.ts), README 'Pin a fixed board' subsection and env blocks, this repo's own opencode.json (line 9 sets it), and the test that relies on it (tests/kanbn-mcp.test.ts:3584).

## Sub-tasks

- [ ] Remove the process.env.KANBN_DEFAULT_PATH branch from getKanbnPath (src/kanbn/instance.ts); resolution becomes per-call path -> process.cwd()
- [ ] Implement a loud warning when KANBN_DEFAULT_PATH is still set: one clear stderr line naming the ignored variable and the board actually used; resolution must not change
- [ ] Remove the ENVIRONMENT entry and env blocks from HELP_TEXT (src/server.ts) and the README 'Pin a fixed board' subsection + config snippets
- [ ] Remove KANBN_DEFAULT_PATH from this repo's opencode.json
- [ ] Update tests: drop the test that relies on KANBN_DEFAULT_PATH and replace it with a cwd-based case (tests/kanbn-mcp.test.ts:3584)
- [ ] Mark the Done ticket 'docs-kanbn-default-path-is-optional...' as superseded (comment) - its 'pin a fixed board' guidance no longer applies
- [ ] verify that a set KANBN_DEFAULT_PATH does NOT change the resolved board (regression guard)
- [ ] verify that an explicit per-call path still overrides cwd, and that no path argument resolves to process.cwd()
- [ ] add a regression test that the resolved board is process.cwd() when KANBN_DEFAULT_PATH is set and no path argument is given

## Relations

- [related-to docs-kanbn-default-path-is-optional-readme-and-help-present-it-like-it-s-required](docs-kanbn-default-path-is-optional-readme-and-help-present-it-like-it-s-required.md)
- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)

## Comments

- author: Kevin J. Duling
  date: 2026-10-13T20:12:57.288Z
  Decision (2026-10-13): loud-warn. When KANBN_DEFAULT_PATH is set it is ignored and a clear warning is printed to stderr naming the variable and the resolved board. Replacement (per-project, explicit) is tracked separately via the kanbn-mcp-config.json field.
