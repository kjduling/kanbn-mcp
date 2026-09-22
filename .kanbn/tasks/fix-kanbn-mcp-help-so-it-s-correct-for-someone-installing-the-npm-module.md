---
created: 2026-09-25T01:03:16.397Z
updated: 2026-09-25T17:40:15.076Z
completed: 2026-09-25T17:40:15.076Z
---

# Fix kanbn-mcp --help so it's correct for someone installing the npm module

The `--help` output is written for a from-source build, not the published npm package:

- USAGE line: `node dist/server.js [options]` - wrong for anyone who ran `npm install -g @kduling/kanbn-mcp`; that user's invocation is `kanbn-mcp` (or `npx -y @kduling/kanbn-mcp`).
- README line 86: "Run `node dist/server.js --help` (or `kanbn-mcp --help` when installed from npm)" - backwards; the npm form should be the primary, `node dist/server.js` reserved for from-source installs.
- HELP_TEXT MCP CLIENT CONFIGURATION examples (opencode + Claude): `command: "node", args: ["/absolute/path/to/kanbn-mcp/dist/server.js"]` - an npm user pasting these gets a path that doesn't exist on their machine.

Work:
1. Rewrite HELP_TEXT USAGE: `kanbn-mcp [command] [options]` first, from-source `node dist/server.js` second, `npx -y @kduling/kanbn-mcp` noted.
2. Provide ready-to-paste npm-based snippets for opencode and Claude Desktop (coordinate with the `mcp`-argument ticket so the args match), keeping the from-source variant as a note.
3. Rewrite README: "From npm" should show install + the config form together; `--help` documented as `kanbn-mcp --help`.
4. Verify --help prints correctly from all three invocations: `kanbn-mcp --help`, `npx -y @kduling/kanbn-mcp --help`, `node dist/server.js --help`.

## Sub-tasks

- [ ] Rewrite HELP_TEXT USAGE + configuration snippets for the npm binary
- [ ] Reorder README: npm install as primary, from-source secondary, correct --help references
- [ ] Smoke-test --help/--version under all three invocations

## Relations

- [related-to support-mcp-as-a-positional-argument-the-common-mcp-server-invocation-convention](support-mcp-as-a-positional-argument-the-common-mcp-server-invocation-convention.md)
- [related-to docs-kanbn-default-path-is-optional-readme-and-help-present-it-like-it-s-required](docs-kanbn-default-path-is-optional-readme-and-help-present-it-like-it-s-required.md)
- [related-to author-a-kanbn-skill-md-agent-facing-usage-guidance-tags-sub-tasks-relation-mirroring](author-a-kanbn-skill-md-agent-facing-usage-guidance-tags-sub-tasks-relation-mirroring.md)

## Comments

- author: Kevin J. Duling
  date: 2026-09-25T17:40:15.064Z
  Done (2026-09-25). HELP_TEXT USAGE now leads with `kanbn-mcp [options]` (after `npm install -g @kduling/kanbn-mcp`), with `npx -y @kduling/kanbn-mcp` and from-source `node dist/server.js` variants. MCP CLIENT CONFIGURATION rewritten for the npm binary: opencode "command": ["kanbn-mcp"], Claude Desktop / mcpServers "command": "kanbn-mcp" with args [], Cline transport form (command kanbn-mcp, args [""]). README installation + client-config sections rewritten to match, from-source told to substitute node dist/server.js. Build clean, 196/196 tests pass. Note: cline config uses `args: [""]` per Kevin's real config - the empty-string arg is inert (server starts via bin basename). The mcp-argument ticket (support-mcp-as-a-positional-argument) remains open - current docs do NOT use an `mcp` arg.

## History

- type: moved
  date: 2026-09-25T17:40:15.076Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
