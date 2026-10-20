# Handoff

## In progress

#82 (agent tools, #12) merged on 2026-10-20; no real Claude Code or Codex session has used the tools yet (setup in `docs/agent-tools.md`).

Four PRs were built together on a local stack branch and rebuilt as separate branches from `main` (67d7078). Each was checked alone after a fresh `npm ci`: lint, typecheck, unit tests, build and `npm run test:e2e` (13 of 15; the 2 tests that use the preview on port 5199 were skipped because another local app held it, and the run moved the preview to 5197). Only `feat/item-pickup-flags` depends on another PR.

### feat/item-pickup-flags

- Task: mark wishlist items picked up from the save, closes #11. Tracks an entry by its item's only pickup spot, or the spot nearest its pin within 250 px; other entries stay manual.
- PR: awaiting review; a draft until `feat/item-pickup-spots` merges, then rebuild it on `main` without that PR's commits.
- Verification: unit tests 205; a read-only check on a copy of the player's save read 691 picked-up spots for the main character. Checked in the app on a scratch data folder: the review lists items picked up and "+3 wishlist items acquired", the tracker marks them.
- Next action: after `feat/item-pickup-spots` merges, rebuild and mark ready.

### feat/item-pickup-spots

- Task: item pickup spots from the map layout files in `catalog.json`, closes #9. Also fixes `item_locations_report.py`, which imported a removed name.
- PR: awaiting review and merge. #83 (spots on the map, ranked first) builds on it.
- Verification: `npm run extract` gives 3,489 spots for 3,458 lots, placing 999 catalog items; unit tests 200.
- Next action: after it merges, mock up #83 once its open questions are answered.

### fix/ashen-capital-graces

- Task: a shown Leyndell grace counts as discovered when its Ashen Capital twin's flag is set, closes #27.
- PR: awaiting review and merge.
- Verification: unit tests 199. Not checked on a real save: no character is past the burning yet.

### fix/import-nothing-new

- Task: the import review offers only Close when nothing changed, closes #6.
- PR: awaiting review and merge.
- Verification: unit tests 199; checked in the app on a scratch data folder.

## Ranked work

Grouped by milestone, in order (GitHub doesn't sort milestones by rank; this list does).

**Item locations**

1. #83 Show the game's item spots on the map (`needs-decision`: open questions on the issue; mockup first; needs #9's PR merged)
2. #9 Place items on the map (PR awaiting review: `feat/item-pickup-spots`)
3. #13 Suggest region and requirements in `add_to_wishlist` (MCP server milestone; ranked here because the region needs #9; the requirements part waits for #15)
4. #11 Extract item pickup flags (PR awaiting review: `feat/item-pickup-flags`, after #9's)
5. #10 Offer "place pin from game data" when wishlisting
6. #48 Spike: waygate locations and destinations from game data
7. #5 Find out what the DLC underground map shows (`needs-decision`)

**MCP server**

8. #20 More MCP options (idea; #12 is done)

**Live playthrough**

9. #6 Save import review shows "Apply" when nothing changed (PR awaiting review: `fix/import-nothing-new`)
10. #27 Ashen Capital graces read as undiscovered (PR awaiting review: `fix/ashen-capital-graces`)
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
