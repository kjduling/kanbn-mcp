---
created: 2026-09-25T01:03:16.432Z
updated: 2026-09-25T01:14:27.450Z
---

# Add kanbn-mcp setup - interactive guided configuration, squeez/unity-cli style

Add a `setup` subcommand to the kanbn-mcp CLI, modelled on squeez's setup (question-and-answer that bakes the answers into agent-visible config) and unity-cli's setup commands: `kanbn-mcp setup` walks the user through short prompts and writes the resulting configuration.

Relationship to the existing exploration ticket "explore-a-setup-command" (guided board configuration that bakes answers into agent-visible guidance): that ticket researches the BOARD-side question set (columns + meaning, type/priority vocab, tag conventions, WIP limits, custom fields) and how agents consume the resulting charter. This ticket is the CLI-level command that would deliver that feature - settle scope explicitly: is `setup` board-scoped (charter + AGENTS.md prose), install-scoped (writes the MCP client config entry), or both? Recommendation: both - `kanbn-mcp setup` defaults to the cwd board, with flags to target a specific board or emit client config only. Cross-link both tickets; the explore ticket's proposal is the design input here.

Non-interactive mode (flags for each answer) so CI/scripts can run it, and re-runs must be idempotent (amend, not duplicate).

AI-agnostic requirement (hard constraint, added 2026-09-25): setup must work for ANY AI client - claude, windsurf, devin, opencode, cline, and any future one (e.g. `bobs-nose`). Collect the board conventions ONCE via Q&A, then EMIT the same guidance into whatever files each client reads:

| Client    | File(s) setup writes |
| --------- | -------------------- |
| opencode  | .opencode/skills/kanbn/SKILL.md + AGENTS.md |
| claude    | CLAUDE.md (+ .claude/skills/kanbn/SKILL.md) |
| windsurf  | .windsurf/rules/kanbn.md |
| cline     | .clinerules/kanbn.md |
| devin     | AGENTS.md + repo SKILL.md (Devin ingests committed SKILL.md) |
| all/unknown | AGENTS.md + skills/kanbn/SKILL.md |

Client locations verified 2026-09-25: opencode skills (.opencode/skills, ~/.config/opencode/skills) + AGENTS.md; Claude Code CLAUDE.md (project + ~/.claude) + .claude/skills; Windsurf .windsurf/rules/*.md (global ~/.codeium/windsurf/memories/global_rules.md); Cline .clinerules/ (global ~/Documents/Cline/Rules on macOS); Devin AGENTS.md (open standard, "works across multiple AI tools") + committed SKILL.md.

Design rules:
1. ONE canonical, AI-agnostic content body: no client names, no client-specific syntax, no references to hosts or CLIs. MCP tool names (kanbn_create_task, ...) ARE allowed - the same tools exist in every client.
2. Envelopes are thin wrappers (skill frontmatter, rule-file headers) generated from the canonical body. A new client = one new emitter function, zero content change.
3. AGENTS.md is the universal envelope - always emitted.
4. Human-setup fallback (explicit requirement): where a client layout is unknown or the emitter cannot cover it, setup prints manual install instructions - where to put the file, what to name it, and a pointer to the canonical body - so a human can wire up ANY client by hand without the command. Guidance-first: the prose must always be copy-pasteable.

## Sub-tasks

- [ ] CLI plumbing: parse `setup` subcommand before the server-start check in src/server.ts (or a src/cli.ts)
- [ ] Settle scope with the explore-a-setup-command ticket: board charter, client config, or both
- [ ] Interactive prompt loop with defaults + non-interactive flag mode; idempotent re-runs
- [ ] Write outputs: board charter (.kanbn/...), canonical client-neutral guidance body, per-client envelopes, optional MCP client config block
- [ ] Build the emitter matrix: one canonical body -> per-client envelopes (opencode skill+AGENTS.md, claude CLAUDE.md+skill, windsurf .windsurf/rules/, cline .clinerules/, devin AGENTS.md+SKILL.md); `--ai <client>` and `--all` selection
- [ ] Human-setup fallback: for unknown/unsupported clients, print the canonical body + copy-paste install instructions (where/what to name) so any client can be wired by hand
- [ ] Enforce content rules: canonical prose stays client-neutral (no host names, no client syntax, only MCP tool names + board concepts)

## Relations

- [related-to explore-a-setup-command-guided-board-configuration-that-bakes-answers-into-agent-visible-guidance](explore-a-setup-command-guided-board-configuration-that-bakes-answers-into-agent-visible-guidance.md)
- [related-to author-a-kanbn-skill-md-agent-facing-usage-guidance-tags-sub-tasks-relation-mirroring](author-a-kanbn-skill-md-agent-facing-usage-guidance-tags-sub-tasks-relation-mirroring.md)
