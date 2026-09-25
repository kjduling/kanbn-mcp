---
created: 2026-09-18T20:13:42.238Z
updated: 2026-09-25T01:09:11.716Z
---

# Directed relation hygiene - depends-on/blocks edges should mirror on both tasks (guidance and/or audit/mirroring)

Observed while dogfooding on the April project: directed relations (depends-on / blocks) are written in ONE direction only. When an agent files "A depends-on B" it almost never also writes the mirror edge "B blocks A" on the blocker's task - leaving the blocking task with an empty or misleading relation list. On April, four tickets depended-on the coupling spike while the coupling spike itself declared zero relations until it was audited and the reverse edges were hand-added.

The gap is behavioural, not just cosmetic:
- Anyone (human or AI) reading the blocker task sees nothing about what it unblocks; the dependency graph is only half-authored.
- Board tooling that renders relations per-task (kanbn's task view, the MCP get_task surface) shows asymmetric graphs.
- A single convention - "directed relation pairs are bidirectional: every depends-on edge implies a blocks edge on the target" - read and enforced by whichever agent files the edge, fixes the asymmetry with one rule.

Consider for the project:
1. Guidance layer - should the relation instructions on the kanbn-mcp tool descriptions (kanbn_add_relation / kanbn_create_task / kanbn_set_relations) state that depends-on/blocks are directed and that agents should mirror the reverse edge? Provide a worked example (A depends-on B => also write B blocks A). Check whether kanbn itself documents this convention (kanbn docs / kanbn's own relation rendering) or leaves it to the caller.
2. Validation/UX in the server - options to compare: (a) read-only detect-and-report tool (e.g. report asymmetric directed relation pairs across a board, like the existing contributor_warnings / find_missing_task_files hygiene tools) so boards can be audited in one call; (b) automatic bidirectional mirroring inside kanbn_add_relation (write depends-on => also write blocks on the target) with an opt-out; (c) validation warnings when creating/editing relations asymmetrically; (d) leave authoring unchanged and rely on guidance-only.
3. Symmetry check caution - mirroring or auto-writing the reverse edge must only apply to DIRECTED types (depends-on/blocks), never to symmetric relations like related-to, or the graph gets noisy. And auto-writing reverse edges needs an idempotent/no-duplicate guarantee.

Deliverable is a decision: guidance-only, audit/report tool, or automatic mirroring, with rationale. Whether kanbn upstream already offers any of this should be checked first. Separate from the existing free-form-fields ticket (that one is about value vocabulary; this one is about directed graph hygiene) - keep them linked via related-to.

## Sub-tasks

- [ ] Check what kanbn upstream already does for directed relations: does it document/documentation or validate that depends-on implies a reverse blocks edge, or render relations per-task asymmetrically?
- [ ] Audit the MCP tool descriptions (add_relation / create_task / set_relations) - what do they currently tell agents about direction and mirroring? Draft the guidance wording + a worked example (A depends-on B => also write B blocks A)
- [ ] Compare validation options: (a) read-only audit/report tool for asymmetric directed pairs (like contributor_warnings), (b) automatic reverse-edge mirroring on add_relation with opt-out + idempotency, (c) validation warning on asymmetric writes, (d) guidance-only
- [ ] Caution check: mirroring must apply ONLY to directed types (depends-on/blocks), never symmetric related-to; ensure no duplicates on re-write
- [ ] Decide with rationale and document on this ticket; no code changes in this scope unless the decision demands it

## Relations

- [related-to guidance-validation-for-free-form-fields-tags-priority-custom-fields-so-ai-clients-use-them-consistently](guidance-validation-for-free-form-fields-tags-priority-custom-fields-so-ai-clients-use-them-consistently.md)
- [related-to author-a-kanbn-skill-md-agent-facing-usage-guidance-tags-sub-tasks-relation-mirroring](author-a-kanbn-skill-md-agent-facing-usage-guidance-tags-sub-tasks-relation-mirroring.md)

## Comments

- author: Kevin J. Duling
  date: 2026-09-25T18:11:02.758Z
  Guidance half delivered (2026-09-25): setup asks mirrorRelations (default on) and the canonical body instructs both-direction edges (depends-on <-> blocks, duplicate-of <-> duplicated-by, related-to once), plus the read-before-write note for kanbn_edit_task/kanbn_set_relations which replace the relations array wholesale. No audit/mirror MCP tool implemented - ticket stays open for that piece.
