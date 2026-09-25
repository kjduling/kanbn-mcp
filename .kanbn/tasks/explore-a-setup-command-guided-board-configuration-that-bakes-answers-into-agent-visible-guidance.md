---
created: 2026-09-18T20:18:25.950Z
updated: 2026-09-25T18:01:26.655Z
completed: 2026-09-25T18:01:26.655Z
---

# Explore a 'setup' command - guided board configuration that bakes answers into agent-visible guidance

Explore a kanbn_mcp 'setup' command, squeez-style: an interactive command that walks a board owner through a short Q&A about how they want their board to work, then bakes the answers into machine-readable guidance AI agents can actually see.

Motivation (observed dogfooding April + this board): boards start blank and every agent session re-invents the vocabulary. Columns, WIP limits, type/priority vocab (feature/bug/spike/doc), tag conventions (the typ:/pri: idea), custom-field definitions, and relation guidance are all configurable but opaque, so agents either guess or go unguided. A guided setup turns board configuration into a first-class onboarding moment and closes the loop: the answers ARE the guidance later agents consume.

Scope to explore:
1. Question set - the minimal set of prompts that covers high-value decisions: board columns and their meaning, type vocabulary, priority vocabulary, tag conventions + whether to enforce (see the free-form-fields ticket), directed-relation mirroring expectation (see the relation-hygiene ticket), WIP limits, custom fields with types.
2. Output artefacts - a "board charter" (e.g. .kanbn/charter.md or a config extension) the MCP writes, plus AGENTS.md-style prose for the repo so any agent sees the rules without running the command.
3. Agent surfacing - the key design question: how do agents CONSUME the charter? Options: a kanbn_get_charter tool returning the stored charter verbatim; surfacing it in tool description text/system prompts; a shorter 'consult on ambiguity' tool. Compare and pick.
4. Interaction design - re-runnable and idempotent (re-run to amend), sequenced questions with sensible defaults, tolerant of partial answering, and cancellability; verbosity and tone (playful vs terse).
5. Reuse - mirror squeez's approach where it fits (its setup/context-budget conventions are well-proven), but survey what the squeez setup actually does before copying; keep this board's own identity.
6. Interplay - the three tickets (free-form fields, relation hygiene, this) share a theme: making board structure visible and steerable for agents. Decide whether they should share one mechanism (charter? customFields? tags?) or stay separate, and cross-link the decision.

Deliverable: a decision on scope + a concrete proposal for the question set, output artefacts, and the consumer tool. Research-heavy, code-light; no implementation in this ticket unless a prototype is needed to validate the agent-surfacing choice.

## Sub-tasks

- [ ] Survey squeez's setup command first - what questions it asks, how it stores guidance, how agents consume it - and note what maps to kanbn_mcp and what doesn't
- [ ] Draft the question set for a kanbn_mcp setup run: columns + meaning, type vocabulary, priority vocabulary, tag conventions, relation-mirroring expectation, WIP limits, custom fields with types
- [ ] Design the output artefacts: board charter location + format (.kanbn/? JSON/MD?), AGENTS.md prose generation, regeneration/idempotency on re-run
- [ ] Design the agent surfacing: compare kanbn_get_charter vs schema/tool-description injection vs on-ambiguity consult; pick one with rationale
- [ ] Decide shared-mechanism question: should this, the free-form-fields ticket, and the relation-hygiene ticket share one conveyance (charter/customFields/tags) or stay separate; document the decision and cross-link
- [ ] Write up the proposal on this ticket: question set, artefacts, consumer tool, interplay - ready for an implementation ticket if approved

## Relations

- [related-to guidance-validation-for-free-form-fields-tags-priority-custom-fields-so-ai-clients-use-them-consistently](guidance-validation-for-free-form-fields-tags-priority-custom-fields-so-ai-clients-use-them-consistently.md)
- [related-to directed-relation-hygiene-depends-on-blocks-edges-should-mirror-on-both-tasks-guidance-and-or-audit-mirroring](directed-relation-hygiene-depends-on-blocks-edges-should-mirror-on-both-tasks-guidance-and-or-audit-mirroring.md)
- [related-to add-kanbn-mcp-setup-interactive-guided-configuration-squeez-unity-cli-style](add-kanbn-mcp-setup-interactive-guided-configuration-squeez-unity-cli-style.md)

## Comments

- author: Kevin J. Duling
  date: 2026-09-25T01:14:27.516Z
  Note (2026-09-25): AI-agnostic constraint applies to the output artefacts. The proposal must cover per-client envelopes generated from ONE canonical client-neutral body - opencode (.opencode/skills/kanbn/SKILL.md + AGENTS.md), claude (CLAUDE.md + .claude/skills), windsurf (.windsurf/rules/kanbn.md), cline (.clinerules/kanbn.md), devin (AGENTS.md + committed SKILL.md) - plus a human-setup fallback: if a client layout is unknown (any future AI), the canonical prose ships/prints with copy-paste install instructions so a human can wire it by hand. The setup and SKILL.md tickets carry the emitter matrix + content rules; keep this ticket's 'AGENTS.md-style prose' artefact aligned with that.
- author: Kevin J. Duling
  date: 2026-09-25T18:01:26.636Z
  Proposal adopted (2026-09-25) -> implemented on the setup ticket. Decisions:\n- Question set: board root, columns + meanings, type tags (bug/feature/documentation/spike), priority tags (critical/high/medium/low), tag style (prefixed typ:/pri: vs plain), enforce vs guide-only (default guide-only), WIP limits, custom fields (name:type:required), relation mirroring (default on). All with defaults; re-runs amend from .kanbn/setup.json.\n- Output artefacts: ONE canonical client-neutral body rendered from answers (src/setup/guidance.ts) -> thin envelopes: AGENTS.md (universal, always), .opencode/skills/kanbn/SKILL.md, CLAUDE.md, .clinerules/kanbn.md, .windsurf/rules/kanbn.md, committed skills/kanbn/SKILL.md. Answers + write manifest in .kanbn/setup.json for idempotent amend + uninstall.\n- Agent surfacing: guidance-first - agents consume the committed files; no new kanbn_get_charter MCP tool this round (charter + skill cover it).\n- Client registration ADDED to scope (board decision): kanbn-mcp setup --mcp writes the MCP server entry into opencode.json, ~/.claude.json, cline_mcp_settings.json, ~/.codeium/windsurf/mcp_config.json - guarded merge, skip when kanbn already present.\n- Interplay: shared mechanism = answers -> one renderer -> all envelopes; setup owns the Q&A the free-form-fields and relation-hygiene tickets were circling (their decisions become setup answers + derived wording).\n- Human-setup fallback: kanbn-mcp setup --print emits the canonical body + per-client install paths for ANY client incl. unknown ones.\n- Reuse notes: modelled on squeez setup (detect hosts, --host= to target one, guarded idempotent writes, uninstall/--check parity); squeez mcp confirms the mcp-positional-argument convention already shipped.

## History

- type: moved
  date: 2026-09-25T18:01:26.655Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
