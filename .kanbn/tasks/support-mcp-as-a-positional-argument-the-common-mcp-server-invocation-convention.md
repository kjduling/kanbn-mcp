---
created: 2026-09-25T01:03:16.336Z
updated: 2026-09-25T17:43:21.641Z
completed: 2026-09-25T17:43:21.641Z
---

# Support 'mcp' as a positional argument - the common MCP-server invocation convention

Many npx-distributed MCP servers are launched with a literal `mcp` argument, so client configs look like:

    {
      "command": "npx",
      "args": ["-y", "@kduling/kanbn-mcp", "mcp"]
    }

or, for a global install:

    { "command": "kanbn-mcp", "args": ["mcp"] }

kanbn-mcp currently starts only when argv[1]'s basename contains "server"/"kanbn-mcp" (isMainEntry, src/server.ts:162-172) or `--run-server` is passed. A positional `mcp` argument is not recognised.

Work:
1. In the CLI handling in src/server.ts, recognise the literal positional arg `mcp` as "start the MCP server" (equivalent to --run-server).
2. Make sure flags still work alongside it: `kanbn-mcp mcp --help`, `kanbn-mcp mcp -v`.
3. Update HELP_TEXT and README config snippets to show the mcp-arg form for npm users (this overlaps with the npm --help ticket - coordinate so the snippets are consistent).
4. Verify no regression for the existing basename-based start (npx resolves argv[1] to the bin path, basename "server.js", which already passes).

Acceptance:
- `kanbn-mcp mcp` starts the stdio server.
- `npx -y @kduling/kanbn-mcp mcp` starts it too.
- Client config examples include the mcp-arg form.

## Sub-tasks

- [ ] Parse `mcp` positional arg in src/server.ts CLI handling and route to main()
- [ ] Confirm flag combinations (help/version) work with the arg present
- [ ] Update HELP_TEXT + README config snippets to the mcp-arg npm form

## Relations

- [related-to fix-kanbn-mcp-help-so-it-s-correct-for-someone-installing-the-npm-module](fix-kanbn-mcp-help-so-it-s-correct-for-someone-installing-the-npm-module.md)

## Comments

- author: Kevin J. Duling
  date: 2026-09-25T17:43:21.613Z
  Done (2026-09-25). isMainEntry (src/server.ts) now treats a literal `mcp` positional argument (argv slice(2)) as an entry signal alongside basename and --run-server, so opaque/renamed launchers and hosts that pass a subcommand-style arg work: `"args": ["mcp"]`. Flags still work with it present (mcp --help / mcp -v). HELP_TEXT USAGE gained the `kanbn-mcp mcp` form + a note in the config section; README notes `["mcp"]` as an accepted args form. Tests: 3 new isMainEntry cases (accepts mcp, opaque launchers, flag combos) - 199/199 pass. Verified live: NDJSON initialize handshake through `node dist/server.js mcp` returns serverInfo kanbn-mcp 1.1.0. Config snippets in docs keep `[]`/`[""]` as the primary forms; `["mcp"]` documented as the host-convention variant.

## History

- type: moved
  date: 2026-09-25T17:43:21.641Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
