---
tags:
  - feature
  - high
created: 2026-10-13T19:45:23.127Z
updated: 2026-10-13T22:01:04.035Z
---

# kanbn-mcp install and uninstall target all known hosts by default, --host=<agent> limits to one

Mirror squeez's host targeting on kanbn-mcp's agent-install surface. squeez ships exactly:
  squeez setup                 -> "Install into every detected host"
  squeez setup --host=<slug>   -> install into one host
  squeez uninstall [--host=<slug>]
kanbn-mcp should behave the same once install/uninstall are split out of setup:

- `kanbn-mcp install` (no flag) wires EVERY known/detected host.
- `kanbn-mcp install --host=<agent>` limits the install to one host (decide whether comma-separated multi is also allowed).
- `kanbn-mcp uninstall` (no flag) reverses everything install wrote, all hosts.
- `kanbn-mcp uninstall --host=<agent>` reverses only that host's entries.

Current behaviour: setup requires --host to emit per-client guidance and only --mcp (over the DETECTED set) performs registration; uninstall takes no --host and reverses the whole manifest. So both the default-all semantics and the uninstall --host filter are new.

Squeez parity note (verified 2026-10-13 against ~/.claude/squeez/bin/squeez): `squeez setup` installs into every DETECTED host and skips undetected ones ("host not detected"), and `--host=<slug>` pins one. Decide whether kanbn-mcp says "all KNOWN" or "all DETECTED" - they differ when a host is installed but not yet configured.

Depends on the split ticket (install must exist as its own command first) and on the $HOME-retarget ticket (where each host's entries land).

## Sub-tasks

- [ ] Decide the default target set: all DETECTED hosts (squeez behaviour) vs all KNOWN hosts - document the choice and how undetected hosts are reported/skipped
- [ ] install: make --host optional - absent = all targets, present = only the listed host(s); support comma-separated multi or not (decide)
- [ ] uninstall: add a --host filter - absent = all manifest entries, present = only that host's entries
- [ ] --list and --dry-run honour the same host selection so planning matches the run
- [ ] Update HELP_TEXT + README with install/uninstall --host semantics
- [ ] verify that `kanbn-mcp install` with no --host wires every known/detected host
- [ ] verify that `kanbn-mcp install --host=<agent>` wires only that host
- [ ] verify that `kanbn-mcp uninstall` with no --host removes every host's entries
- [ ] verify that `kanbn-mcp uninstall --host=<agent>` removes only that host's entries and leaves the others
- [ ] add tests for all four combinations (install all / install one, uninstall all / uninstall one)

## Relations

- [related-to split-kanbn-mcp-setup-into-install-and-setup](split-kanbn-mcp-setup-into-install-and-setup.md)
- [related-to kanbn-mcp-install-writes-only-per-host-home-config-drop-project-level-registration](kanbn-mcp-install-writes-only-per-host-home-config-drop-project-level-registration.md)
