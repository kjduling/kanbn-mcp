---
created: 2026-09-25T01:03:16.195Z
updated: 2026-09-25T17:40:14.998Z
completed: 2026-09-25T17:40:14.998Z
---

# Docs: KANBN_DEFAULT_PATH is optional - README and --help present it like it's required

The README "MCP client configuration" section prints a `KANBN_DEFAULT_PATH` env block inside EVERY config snippet, which reads as required (only line 110 marks it "(Optional)"). The HELP_TEXT in src/server.ts says "Optional" in the ENVIRONMENT block but then appends the env var to both config examples below it as if it were the primary story.

Actual resolution (getKanbnPath in src/kanbn/instance.ts): explicit per-call `path` argument -> `KANBN_DEFAULT_PATH` env var -> `process.cwd()`. There is no home-directory fallback in the code; the observed "looks in the home directory" default comes from MCP hosts launching a globally-installed/npx binary with cwd = the user's home directory.

Work:
1. Decide and document the real default in ONE place (README + HELP_TEXT): no per-call path and no env var -> process.cwd(), which for the npm install is typically the host's launch directory (often the home dir). Say it plainly instead of a bare "Optional".
2. Restructure README client-config: primary snippet WITHOUT the env block; a separate "Pin a fixed board" subsection shows KANBN_DEFAULT_PATH.
3. Mirror the same shape in HELP_TEXT's MCP CLIENT CONFIGURATION examples.
4. Cross-link with the npm --help ticket (README line 86 also documents how to print the snippets, which changes there).

## Sub-tasks

- [ ] Confirm the intended default (cwd vs home) and document it in src/server.ts HELP_TEXT env block
- [ ] Rewrite README client-config section: optional env var treated as optional, fixed-board subsection separate
- [ ] Align HELP_TEXT config examples with the README shape

## Relations

- [related-to fix-kanbn-mcp-help-so-it-s-correct-for-someone-installing-the-npm-module](fix-kanbn-mcp-help-so-it-s-correct-for-someone-installing-the-npm-module.md)

## Comments

- author: Kevin J. Duling
  date: 2026-09-25T17:40:14.967Z
  Done (2026-09-25). README 'MCP client configuration' rewritten: primary snippets no longer carry the env block; a separate 'Which board does the server use?' subsection states KANBN_DEFAULT_PATH is optional and documents the default - server resolves the board from its working directory (process.cwd()), which for a global npm launch is usually the project the host opened or the home directory. HELP_TEXT ENVIRONMENT block updated to match. Config snippets now use the `kanbn-mcp` binary (see the npm-help ticket, same change).

## History

- type: moved
  date: 2026-09-25T17:40:14.998Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
