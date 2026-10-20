# Handoff

## In progress

#72 to #81 merged on 2026-10-20. Before #6 or #27 starts, run `npm run extract` so graces get `entity` (needed by #72's last-grace import).

### feat/mcp-wishlist

- Task: agent tools for the wishlist, closes #12. Design changed from the issue (agreed with the player 2026-10-20): the tools run in the app's window and only queue proposals, which the player applies or dismisses under "Agent changes"; a stdio MCP server (`server/mcp.ts`) reaches the window through a relay on the dev/preview server. Also fixes undo back to the loaded map not saving.
- PR: opened on 2026-10-20 (`gh pr view`), waiting for the player's review and merge. Its body closes #12.
- Code checkpoint: see `git log`; on 2bc5880 (main). Lint, typecheck, unit tests (198), build and `npm run test:e2e` (13 of 15) pass. The 2 tests that use the preview on port 5199 were not run, since another local app held that port; the run used a temporary config with the preview on 5197.
- Checked by hand on a scratch data folder: proposals sent through `node server/mcp.ts`, the review in English (wide) and zh-TW (phone width), apply, apply all, dismiss, and `get_proposal_status`.
- Next action: after the PR merges, try the tools from a real Claude Code or Codex session. WebMCP in the page is noted on #20.

## Ranked work

Grouped by milestone, in order (GitHub doesn't sort milestones by rank; this list does).

**MCP server**

1. #12 Add an MCP server for the wishlist (not blocked: both `add_to_wishlist` modes work without item positions)
2. #20 More MCP options (idea; after #12)

**Item locations**

3. #9 Place items on the map (turns the #8 spike's report into `catalog.json` positions)
4. #13 Suggest region and requirements in `add_to_wishlist` (MCP server milestone; ranked here because the region needs #9; the requirements part waits for #15)
5. #11 Extract item pickup flags
6. #10 Offer "place pin from game data" when wishlisting
7. #48 Spike: waygate locations and destinations from game data
8. #5 Find out what the DLC underground map shows (`needs-decision`)

**Live playthrough**

9. #6 Save import review shows "Apply" when nothing changed (small; run `npm run extract` first so graces get `entity`)
10. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
11. #68 Focus mode that shows only the current path (`needs-decision`: open questions on the issue)
12. #70 Zoom to fit the current path when the automatic import changes it (`needs-decision`)
13. #66 Show the character's position from the save on the map (`needs-decision`; spike first)

**Route editing**

14. #41 Edit a selected path (insert a node between two others)
15. #71 Make the mobile bottom sheet behave and look like an iOS sheet (`needs-decision`)
16. #4 Try linking two layers with a waygate by hand
17. #19 Bring over only what's new from another profile's map (idea)

**Prerequisites**

18. #15 Requirement flags on paths and items
19. #17 "Blocked by X" view
20. #21 Constraints to avoid items or bosses (idea)

**Quality** (ongoing; pick up between milestones)

21. #7 Check English and zh-TW together

## Pending

Nothing.
