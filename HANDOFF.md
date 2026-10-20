# Handoff

## In progress

#72 to #77 merged on 2026-10-20. Before #6 or #27 starts, run `npm run extract` so graces get `entity` (needed by #72's last-grace import).

### test/e2e-setup

- Task: end-to-end browser tests, closes #3 (the player's request, 2026-10-20: set this up before the OBS viewer PR, covering all five flows).
- PR: none yet; waiting for the player's approval to push and open it.
- Code checkpoint: 33c6148, on e0bca77 (main). Lint, typecheck, unit tests (172), build and `npm run test:e2e` (8, run twice) pass.
- State: Playwright with a dev and a preview server saving into a disposable temp folder; specs for the five flows of #3, saving across servers, the cross-window conflict, and the phone layout. See `docs/testing.md`. Chromium is installed in this Mac's Playwright cache.
- Next action: after this PR, start #14 on a branch from it (or from main once merged), adding a viewer spec. Decisions for #14 are on the issue.

## Ranked work

Grouped by milestone, in order (GitHub doesn't sort milestones by rank; this list does).

**Quality** (in progress first, since the viewer PR builds on it)

1. #3 Add end-to-end browser tests

**OBS viewer**

2. #14 Port the viewer from the old project

**MCP server**

3. #12 Add an MCP server for the wishlist (not blocked: both `add_to_wishlist` modes work without item positions)
4. #20 More MCP options (idea; after #12)

**Item locations**

5. #9 Place items on the map (turns the #8 spike's report into `catalog.json` positions)
6. #13 Suggest region and requirements in `add_to_wishlist` (MCP server milestone; ranked here because the region needs #9; the requirements part waits for #15)
7. #11 Extract item pickup flags
8. #10 Offer "place pin from game data" when wishlisting
9. #48 Spike: waygate locations and destinations from game data
10. #5 Find out what the DLC underground map shows (`needs-decision`)

**Live playthrough**

11. #6 Save import review shows "Apply" when nothing changed (small; run `npm run extract` first so graces get `entity`)
12. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
13. #68 Focus mode that shows only the current path (`needs-decision`: open questions on the issue)
14. #70 Zoom to fit the current path when the automatic import changes it (`needs-decision`)
15. #66 Show the character's position from the save on the map (`needs-decision`; spike first)

**Route editing**

16. #41 Edit a selected path (insert a node between two others)
17. #71 Make the mobile bottom sheet behave and look like an iOS sheet (`needs-decision`)
18. #4 Try linking two layers with a waygate by hand
19. #19 Bring over only what's new from another profile's map (idea)

**Prerequisites**

20. #15 Requirement flags on paths and items
21. #17 "Blocked by X" view
22. #21 Constraints to avoid items or bosses (idea)

**Quality** (ongoing; pick up between milestones)

23. #7 Check English and zh-TW together

## Pending

Nothing.
