---
tags:
  - feature
  - high
created: 2026-10-13T20:13:53.778Z
updated: 2026-10-13T22:06:15.678Z
---

# Add a per-project board path to $HOME/.kanbn/kanbn-mcp-config.json (replaces KANBN_DEFAULT_PATH)

Give users a SAFE, explicit, per-project way to pin the board directory - replacing the ambient KANBN_DEFAULT_PATH footgun. Add a board-path entry to the GLOBAL config at $HOME/.kanbn/kanbn-mcp-config.json, keyed per project.

Board decision (2026-10-13):
- The field lives in the GLOBAL $HOME config, keyed per project - NOT the project's own .kanbn file, which would be circular (that file sits inside the board it would be redirecting).
- The field sets the board PATH (the workspace directory), i.e. the replacement for KANBN_DEFAULT_PATH.
- Explicit and scoped: only the named project is affected, so it cannot silently misroute every other project the way the env var did.

Sketch:
  $HOME/.kanbn/kanbn-mcp-config.json
  {
    "projects": {
      "<project-root>": { "boardPath": "/path/to/board/root" }
    }
  }

Resolution order becomes: explicit per-call `path` argument > per-project boardPath (matched from the project directory) > process.cwd(). No env var anywhere.

Depends on the config-file ticket (the global kanbn-mcp-config.json must exist first). Relates to the KANBN_DEFAULT_PATH removal ticket - this is the sanctioned replacement; that ticket only ignores + warns.

## Sub-tasks

- [ ] Define the schema shape: a per-project section keyed by project (e.g. projects["<root>"].boardPath); decide the key (absolute project root vs a slug/name)
- [ ] Define how the server matches its working directory to a project entry (exact path, nearest ancestor, macOS case/normalisation)
- [ ] Resolution order: per-call path > per-project boardPath > process.cwd(); wire it into getKanbnPath
- [ ] Decide behaviour when a configured boardPath does not exist or is not a board: hard error vs warn + fall back to cwd
- [ ] Keep this path field OUT of the board-convention answer merge (columns/tags) - it is a location, not a board setting
- [ ] Update HELP_TEXT + README with the per-project board-path field and the new resolution order; drop any remaining 'pin a board' env narrative
- [ ] verify that with a matching per-project boardPath the server resolves to it
- [ ] verify that with no matching entry the server resolves to process.cwd()
- [ ] verify that an explicit per-call path still wins over the config entry
- [ ] add tests for project matching + the full resolution order (path > config > cwd)

## Relations

- [depends-on move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override](move-board-config-to-home-kanbn-kanbn-mcp-config-json-with-per-field-project-override.md)
- [related-to remove-kanbn-default-path-resolve-the-board-from-the-project-directory-only](remove-kanbn-default-path-resolve-the-board-from-the-project-directory-only.md)
