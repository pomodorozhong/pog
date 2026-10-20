# Handoff

## In progress

#72 to #79 merged on 2026-10-20. Before #6 or #27 starts, run `npm run extract` so graces get `entity` (needed by #72's last-grace import).

### chore/rename-to-pog

- Task: rename the project to Path of Grace (pog), closes #80. The GitHub repository is renamed and `origin` points to `pomodorozhong/pog`. The branch isn't pushed yet; its PR waits for the player's approval.
- Code checkpoint: c025f02, on 18db698 (main). Lint, typecheck, unit tests (182), build and `npm run test:e2e` (13) pass.
- State: the name, `POG_*` environment variables, docs links and zh-TW name 賜福黯道 are changed. The server moves the old `route-of-grace` data folder to `pog` on first use. Not tried on the player's real data folder yet: running this branch moves it, and `main` would then start empty.
- Next action: after the player approves, push and open the PR (`open-pr`). After it merges, run the app once on `main` to confirm the data folder moved to `pog`.

## Ranked work

Grouped by milestone, in order (GitHub doesn't sort milestones by rank; this list does).

**Rename**

1. #80 Rename the project to Path of Grace (pog)

**MCP server**

2. #12 Add an MCP server for the wishlist (not blocked: both `add_to_wishlist` modes work without item positions)
3. #20 More MCP options (idea; after #12)

**Item locations**

4. #9 Place items on the map (turns the #8 spike's report into `catalog.json` positions)
5. #13 Suggest region and requirements in `add_to_wishlist` (MCP server milestone; ranked here because the region needs #9; the requirements part waits for #15)
6. #11 Extract item pickup flags
7. #10 Offer "place pin from game data" when wishlisting
8. #48 Spike: waygate locations and destinations from game data
9. #5 Find out what the DLC underground map shows (`needs-decision`)

**Live playthrough**

10. #6 Save import review shows "Apply" when nothing changed (small; run `npm run extract` first so graces get `entity`)
11. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
12. #68 Focus mode that shows only the current path (`needs-decision`: open questions on the issue)
13. #70 Zoom to fit the current path when the automatic import changes it (`needs-decision`)
14. #66 Show the character's position from the save on the map (`needs-decision`; spike first)

**Route editing**

15. #41 Edit a selected path (insert a node between two others)
16. #71 Make the mobile bottom sheet behave and look like an iOS sheet (`needs-decision`)
17. #4 Try linking two layers with a waygate by hand
18. #19 Bring over only what's new from another profile's map (idea)

**Prerequisites**

19. #15 Requirement flags on paths and items
20. #17 "Blocked by X" view
21. #21 Constraints to avoid items or bosses (idea)

**Quality** (ongoing; pick up between milestones)

22. #7 Check English and zh-TW together

## Pending

Nothing.
