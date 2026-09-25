---
created: 2026-09-25T01:09:06.417Z
updated: 2026-09-25T18:11:02.696Z
completed: 2026-09-25T18:11:02.696Z
---

# Author a Kanbn SKILL.md - agent-facing usage guidance (tags, sub-tasks, relation mirroring)

Provide a SKILL.md that a user can install into their AI client so the agent knows how to work a Kanbn board through the kanbn-mcp tools. The MCP server is now distributable (npm: @kduling/kanbn-mcp), but its tools carry no board conventions - every agent session re-invents the vocabulary. A skill is the portable instruction file that closes that gap.

Why SKILL.md is the right vehicle (confirmed against the opencode V2 skills docs):
- Skills are user-installable and cross-project: opencode discovers global `~/.config/opencode/skills/<id>/SKILL.md` (and project `.opencode/skills/<id>/SKILL.md`). The user drops the file in, every agent thereafter sees it. AGENTS.md/schema descriptions only apply where we control the repo, which is never the case for a downstream npm user.
- Skill ID comes from the directory name (`kanbn/` -> id `kanbn`); a `description` frontmatter is required for the model to auto-discover it.
- Skills are portable: same file also lands in `~/.claude/skills/` for Claude and other sources opencode reads for compatibility.

Proposed draft (deliverable for this ticket):

```markdown
---
name: Kanbn
description: Work with Kanbn boards through the kanbn-mcp MCP tools - tag conventions, sub-task structure, and bidirectional relation links. Use when planning, filing, editing, or tracking tickets on any Kanbn board.
---

# Kanbn board work

Use this when the user asks you to plan, file, edit, or track work on a Kanbn board through the kanbn-mcp tools (kanbn_create_task, kanbn_edit_task, kanbn_get_task, kanbn_move_task, kanbn_add_relation, kanbn_search, ...).

## Tags - classify type and priority

Tag every ticket with two families:

1. Type - what the ticket is: typ:bug, typ:feature, typ:documentation, typ:spike, ...
2. Priority - how urgent it is: pri:critical, pri:high, pri:medium, pri:low

Derive both from the request (a reported bug => typ:bug plus a priority; a requested feature => typ:feature plus a priority). Reuse existing tags; never invent a new family or format.

## Sub-tasks - break work down

Put breakdown items in the subTasks array, never as bullet lists in description:
- the ticket's work items
- acceptance test items ("verify that ...")
- unit test requirements ("add a test for ...")

Bullets in description are invisible to the board: they don't render, aren't tracked, and don't count in kanbn_search.

## Relations - link tickets bidirectionally

Wire tickets with relations and write BOTH ends of directed pairs:
- A depends-on B  =>  also add B blocks A
- X duplicate-of Y  =>  also add Y duplicated-by X
- blocked-by is the read-direction alias of the blocks/depends-on pair - prefer that pair
- related-to is symmetric - record it once on either ticket

Prefer kanbn_add_relation / kanbn_remove_relation for edges; kanbn_edit_task and kanbn_set_relations replace the whole relations array.

## Verify after every create/edit

Follow kanbn_create_task / kanbn_edit_task with kanbn_get_task (or kanbn_status) and confirm name, tags, subTasks, and relations - both directions. Stale or abbreviated arguments silently drop data.
```

Open decision points (cross-linked; resolve before or alongside shipping this file):
1. Tag vocabulary - the draft uses the `typ:`/`pri:` prefix style explored on this board. Confirm against the free-form-fields ticket decision and update the draft.
2. Relation mirroring wording - if the relation-hygiene ticket lands server-side auto-mirroring or an audit tool, "write BOTH ends" becomes "the server mirrors it" (or "run the audit"). Keep the two in sync.
3. What kanbn itself accepts/renders for relation types (blocked-by, duplicate-of/duplicated-by) - verify before finalising the vocabulary; the relation-hygiene ticket sub-task 1 owns this check.

Distribution plan:
- Source of truth in-repo at `skills/kanbn/SKILL.md` (tracked; `.opencode/` is also viable for dogfooding but `skills/` reads cleanly).
- Ship in npm: add `"skills"` to package.json `files` (currently `["dist"]`).
- README section "Install the AI guide": copy to `~/.config/opencode/skills/kanbn/` (opencode global) verbatim; notes for other clients.
- Wire into `kanbn-mcp setup` (setup ticket): the setup command should offer to install/copy the skill and generate the board-specific AGENTS.md/charter from the same vocabulary so both agree.

AI-agnostic requirement (hard constraint, added 2026-09-25): the CONTENT must be client-neutral - usable by claude, windsurf, devin, opencode, cline, and any future client. SKILL.md is ONE envelope (native to opencode; compatible with ~/.claude/skills; Devin ingests committed SKILL.md files). Windsurf (.windsurf/rules/) and Cline (.clinerules/) read their own rule files, so the same prose must be emitted into those by kanbn-mcp setup (see the setup ticket's emitter matrix). Consequences:
1. The canonical prose must not mention any client, host, or client-specific feature (no "opencode", no "skill tool", no slash commands, no client CLIs). Only kanbn-mcp MCP tool names and board concepts.
2. This repo ships the canonical body + the SKILL.md envelope; setup emits the same body into CLAUDE.md, .clinerules/kanbn.md, .windsurf/rules/kanbn.md, AGENTS.md, .opencode/skills/kanbn/SKILL.md.
3. AGENTS.md is the universal envelope - always generated from the same body.
4. Human-setup fallback: if a client's layout is unknown, a human must still be able to set it up - ship/print the canonical prose with copy-paste install instructions. The draft above already conforms (client-neutral); keep it that way while refining.

## Sub-tasks

- [ ] Finalise SKILL.md content in repo (skills/kanbn/SKILL.md): frontmatter name+description, tag taxonomy, sub-task rules, relation mirroring pairs, verify-after-create
- [ ] Confirm tag vocabulary (typ:/pri: vs plain) against the free-form-fields decision and update the draft
- [ ] Align relation-mirroring wording with the relation-hygiene decision (guidance-only vs server auto-mirror/audit)
- [ ] Verify kanbn accepts/renders the relation type vocabulary (blocked-by, duplicate-of/duplicated-by, depends-on/blocks)
- [ ] Add 'skills' to package.json files so npm ships it; add README 'Install the AI guide' section (coordinate with the npm-help ticket)
- [ ] Wire into kanbn-mcp setup: setup offers to install the skill and keeps AGENTS.md/charter vocabulary in sync
- [ ] Audit for client-neutrality: canonical prose mentions no hosts/clients; SKILL.md is one envelope - align per-client install/emit with kanbn-mcp setup (CLAUDE.md, .clinerules/, .windsurf/rules/, AGENTS.md)
- [ ] Human-setup fallback: document where each client looks for guidance files so the skill/prose can be installed by hand when setup can't cover a client

## Relations

- [related-to guidance-validation-for-free-form-fields-tags-priority-custom-fields-so-ai-clients-use-them-consistently](guidance-validation-for-free-form-fields-tags-priority-custom-fields-so-ai-clients-use-them-consistently.md)
- [related-to directed-relation-hygiene-depends-on-blocks-edges-should-mirror-on-both-tasks-guidance-and-or-audit-mirroring](directed-relation-hygiene-depends-on-blocks-edges-should-mirror-on-both-tasks-guidance-and-or-audit-mirroring.md)
- [related-to add-kanbn-mcp-setup-interactive-guided-configuration-squeez-unity-cli-style](add-kanbn-mcp-setup-interactive-guided-configuration-squeez-unity-cli-style.md)
- [related-to fix-kanbn-mcp-help-so-it-s-correct-for-someone-installing-the-npm-module](fix-kanbn-mcp-help-so-it-s-correct-for-someone-installing-the-npm-module.md)

## Comments

- author: Kevin J. Duling
  date: 2026-09-25T18:11:02.684Z
  DONE (2026-09-25). SKILL.md body is the setup command's canonical renderer: guidance.ts renderSkill() emits frontmatter (name: kanbn, description, version) + the client-neutral body, and `kanbn-mcp setup` writes per-project skills (.opencode/skills/kanbn/SKILL.md, skills/kanbn/SKILL.md). Shipped repo file skills/kanbn/SKILL.md is generated from renderSkill(skillPlaceholderAnswers()) and a test pins it to the renderer so it can't drift. package.json files now includes skills/; README has a hand-install section (copy to ~/.config/opencode/skills/kanbn/SKILL.md, ~/.claude/skills/kanbn/SKILL.md). Body covers tags (type + priority, prefixed vs plain), subTasks for breakdown/acceptance/test, relation mirroring (depends-on <-> blocks, duplicate-of <-> duplicated-by, related-to once), verify-after-create, WIP limits and custom fields when configured.

## History

- type: moved
  date: 2026-09-25T18:11:02.696Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
