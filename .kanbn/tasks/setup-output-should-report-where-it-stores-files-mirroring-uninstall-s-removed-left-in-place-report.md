---
tags:
  - 'typ:feature'
  - 'pri:medium'
created: 2026-09-25T18:47:00.260Z
completed: 2026-09-25T18:47:00.260Z
updated: 2026-09-25T18:47:21.599Z
---

# setup output should report where it stores files, mirroring uninstall's Removed/Left-in-place report

kanbn-mcp uninstall prints where it removes things (Removed: / Left in place: with per-path notes, including the manifest). setup only printed bare paths with no roles and never mentioned the manifest. Request: setup must show where each file is stored (role label per target), report registrations, and report the manifest path - same verbosity class as uninstall.

## Sub-tasks

- [x] Thread per-target changed status from the emitters (upsertBlock / writeManagedFile) into WrittenTarget.changed.
- [x] Print Wrote: with role-labelled paths and Unchanged (already current): for idempotent re-runs, mirroring uninstall's Removed:/Left in place:.
- [x] Report MCP registrations (Registered:) and the stored manifest path (Stored manifest: .kanbn/setup.json).
- [x] Dry-run mirrors the report: Would write: / Would register:.
- [x] Add acceptance tests: a real run shows Wrote: + role labels + Stored manifest; an idempotent re-run shows Unchanged (already current):.
- [x] Add a test for the dry-run caption so the wording stays pinned.

## Comments

- author: jinx
  date: 2026-09-25T19:00:00.000Z
  Implemented: replace printPlannedWrites with printWriteReport (role labels per host, changed/unchanged split, registrations, manifest). 238/238 tests green; demoed Wrote:/Unchanged:/Stored manifest: live + the dry-run Would write: mirror. Not yet committed when this ticket was logged.
- author: jinx
  date: 2026-09-25T19:15:00.000Z
  Committed as fd253e9. Live demo: first run shows Wrote: (6 role-labelled paths) + Registered: + Stored manifest:; idempotent re-run shows Unchanged (already current):; dry-run shows Would write: / Would register:.
