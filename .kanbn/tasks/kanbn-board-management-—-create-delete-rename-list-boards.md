---
created: 2026-09-12T04:59:25.167Z
---

# kanbn-board-management — create, delete, rename, list boards

Implement MCP tools for kanbn library board management methods:
- `createBoard(slug, options)` → `kanbn_create_board`
- `deleteBoard(slug)` → `kanbn_delete_board_file` (distinct from existing `kanbn_delete_board` which removes directory)
- `renameBoard(slug, newSlug, newName)` → `kanbn_rename_board`
- `listBoards()` → `kanbn_list_boards`
- `getBoardsSummary()` → `kanbn_boards_summary`
- `boardExists(slug)` → `kanbn_board_exists`
- `getReservedBoardSlugs()` → `kanbn_reserved_board_slugs`
- `validateBoardSlug(slug)` → `kanbn_validate_board_slug`
- `findOrphanedTasks(slug)` → `kanbn_find_orphaned_tasks`
- `getCrossBoardTasks()` → `kanbn_cross_board_tasks`
- `findTasksOnOtherBoards()` → `kanbn_tasks_on_other_boards`

Acceptance criteria:
- All 11 MCP tools are implemented and dispatch correctly
- Board creation returns the board slug and creates the index file
- Board deletion returns orphaned task IDs
- Board rename updates all references correctly
- List/summary return correct data from the kanbn board
- Validation rejects reserved slugs with clear error messages

## Sub-tasks

- [ ] Implement `kanbn_create_board` tool with slug and options params
- [ ] Implement `kanbn_delete_board_file` tool that calls deleteBoard(slug) and returns orphaned task IDs
- [ ] Implement `kanbn_rename_board` tool with slug, newSlug, newName params
- [ ] Implement `kanbn_list_boards` tool returning board array
- [ ] Implement `kanbn_boards_summary` tool returning boardSummary array with stats
- [ ] Implement `kanbn_board_exists` tool returning boolean
- [ ] Implement `kanbn_reserved_board_slugs` tool returning reserved slugs array
- [ ] Implement `kanbn_validate_board_slug` tool with validation logic
- [ ] Implement `kanbn_find_orphaned_tasks` tool
- [ ] Implement `kanbn_cross_board_tasks` tool
- [ ] Implement `kanbn_tasks_on_other_boards` tool
- [ ] Unit tests — happy paths
- [ ] Unit tests — sad paths (invalid slug, duplicate board, missing board, reserved slug)

## History

- type: created
  date: 2026-09-12T04:59:25.167Z
  column: Backlog
  fromProgress: 0
  toProgress: 0
  author: Kevin J. Duling
