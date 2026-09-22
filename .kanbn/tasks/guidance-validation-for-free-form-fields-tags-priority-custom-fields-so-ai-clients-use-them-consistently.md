---
created: 2026-09-18T20:04:39.742Z
updated: 2026-09-25T01:09:11.513Z
---

# Guidance/validation for free-form fields (tags, priority, custom fields) so AI clients use them consistently

Observation from dogfooding kanbn-mcp on the April project: fields like `tags`, `priority`, and any configured custom fields are completely free-form - no set values, no schema. Works when the AI remembers ("hmm, what did we decide the priority tag naming was?"), but there is nothing in the tool surface that GUIDES or RESTRICTS the values an agent can write. Relationships and sub-tasks already get semantic descriptions in the tool schema (per AGENTS.md: "a field agents can't discover is a field they'll misuse"); free-form value fields have no equivalent guard rail.

Consider for the project:
1. Guidance layer - do the tool `description`s (or AGENTS.md / README) explain how agents should pick values for `tags`, `priority`, and custom fields? Examples of tag conventions (prefix namespacing like `typ:bug` / `pri:high`, the project's own go-to taxonomy) would stop each agent session from inventing its own. Verify the schema description text is automatically surfaced to clients or must be re-stated per-tool.
2. Restriction/validation layer - should the server enforce or hint at allowed values? Options to compare: (a) custom-field types in the kanbn config (`options.task.customFields` with types/enums) surfacing as enum hints in the tool schema; (b) a `priority` validation (kanbn's low/medium/high vocabulary); (c) `tagsSuggestion`/tag-casing normalization (e.g. reject or coerce whitespace, force lowercase or prefix discipline); (d) a read-only "collect values" tool already exists (kanbn_collect_contributor_values) - is a `collect_tags`-style counterpart warranted so agents can stay consistent with existing tag vocabulary?
3. Failure modes - what does kanbn itself do today when an agent writes an out-of-schema value (e.g. priority "urgent")? Silently accepted? Rejected? Rendered inconsistently? Whatever kanbn does dictates how loudly the MCP should intervene.
4. Scope line - this is a separate project from April; only research/design/consider here, nothing to ship in April's board.

Deliverable is a decision: guidance-only, validation-only, or guidance + enum surfacing, with a concrete proposal for schema-description text and/or custom-field typing. No code changes implied until that decision lands.

## Sub-tasks

- [ ] Audit the tool schema: which free-form value fields (tags, priority, custom fields) currently lack semantic guidance in their descriptions, and is schema description text automatically visible to MCP clients?
- [ ] Survey what kanbn itself does on out-of-schema values (priority 'urgent', malformed tag, bad custom-field type): silently accepted, rejected, or mis-rendered?
- [ ] Propose guidance-only answer: example tag conventions (typ:/pri: prefixing, taxonomy) and where they live (schema description, AGENTS.md, README) - with a concrete wording diff
- [ ] Compare validation/enum options: kanbn customField types surfacing as schema enums, priority vocabulary enforcement, tag normalization - cost/benefit each
- [ ] Decide (guidance and/or validation) with rationale and document the decision on this ticket; no code changes in this scope unless the decision demands a spike

## Relations

- [related-to author-a-kanbn-skill-md-agent-facing-usage-guidance-tags-sub-tasks-relation-mirroring](author-a-kanbn-skill-md-agent-facing-usage-guidance-tags-sub-tasks-relation-mirroring.md)
