---
created: 2026-09-12T04:59:25.167Z
updated: 2026-09-12T22:39:09.924Z
completed: 2026-09-12T22:39:09.924Z
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

- [x] Implement kanbn_create_board tool with slug and options params
- [x] Implement kanbn_delete_board_file tool that calls deleteBoard(slug) and returns orphaned task IDs
- [x] Implement kanbn_rename_board tool with slug, newSlug, newName params
- [x] Implement kanbn_list_boards tool returning board array
- [x] Implement kanbn_boards_summary tool returning boardSummary array with stats
- [x] Implement kanbn_board_exists tool returning boolean
- [x] Implement kanbn_reserved_board_slugs tool returning reserved slugs array
- [x] Implement kanbn_validate_board_slug tool with validation logic
- [x] Implement kanbn_find_orphaned_tasks tool
- [x] Implement kanbn_cross_board_tasks tool
- [x] Implement kanbn_tasks_on_other_boards tool
- [x] Unit tests — happy paths
- [x] Unit tests — sad paths (invalid slug, duplicate board, missing board, reserved slug)

## Comments

- author: Jinx
  date: 2026-09-12T23:30:00.000Z
  All 11 board-management tools implemented and registered (TOOLS, dispatch, HELP_TEXT, README). Tests (11) cover: create (happy + duplicate/reserved sad), delete_board_file (orphans returned, main-board reject), rename (slug+name, main/duplicate rejects), list/summary, board_exists toggle, reserved/validate (invalid + reserved), find_orphaned, cross_board, tasks_on_other_boards. Test learnings: index columns keys are display names (columns.Backlog) while columnContent keys are slugified (columnContent.backlog); cross-board references added via scoped instance.board(slug).addTaskToBoard(id, column); .board() re-scopes the instance so read main index via a fresh instance. Note: kanbn_delete_board (directory-removing) intentionally remains distinct from kanbn_delete_board_file per ticket. 89/89 tests pass, tsc clean.

## History

- type: moved
  date: 2026-09-12T22:39:09.924Z
  fromColumn: Backlog
  toColumn: Done
  author: Kevin J. Duling
