---
created: 2026-09-07T18:00:58.160Z
updated: 2026-09-07T18:33:20.893Z
---

# Add size limit to kanbn_status response

The `kanbn_status` handler returns the full board index without any size limit:

```js
const index = await getIndexFn.call(instance);
return {
    content: [{ type: "text", text: JSON.stringify(index, null, 2) }],
};
```

No size limit, no pagination. A board with hundreds of tasks could return megabytes of JSON. This will choke MCP transports and LLM context windows.

**Required fix:**
- Add a configurable max response size limit (e.g., 10KB or 100KB)
- Truncate the output with a message indicating the response was truncated
- Consider returning only summary/board-level info by default with an option for full index
- Document the size limit in the tool's description

## Sub-tasks

- [ ] undefined
- [ ] undefined
- [ ] Create a unit test to verify

## History

- type: created
  date: 2026-09-07T18:00:58.160Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
