---
created: 2026-09-07T18:00:58.160Z
updated: 2026-09-13T20:22:27.950Z
completed: 2026-09-13T20:22:27.950Z
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

- [x] Add a configurable max response size limit (KANBN_MAX_RESPONSE_SIZE, default 100KB)
- [x] Truncate oversized kanbn_status output with a truncation marker
- [x] Create a unit test to verify

## Comments

- author: Jinx
  date: 2026-09-13T21:15:00.000Z
  kanbn_status now caps its response at 100KB by default, configurable via KANBN_MAX_RESPONSE_SIZE (bytes, read per call). Output that exceeds the limit first falls back to compact JSON; if that still exceeds the limit it is truncated at a UTF-8-safe character boundary (binary search on byte length) and ends with marker '[kanbn_status response truncated: exceeds size limit]'. Added getMaxResponseSize() and truncateResponse() helpers, and documented the limit + env var in the tool description. 2 tests (162 → 164): truncation under a tiny 120-byte limit (marker present, byte length <= limit) and compact-JSON fallback that stays parseable under 900 bytes. 164/164 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-13T20:22:27.950Z
  fromColumn: Todo
  toColumn: Done
  author: Kevin J. Duling
