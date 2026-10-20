# Handoff

## In progress

#72 to #76 merged on 2026-10-20, and every merged branch was deleted, locally and on GitHub. Before #6 or #27 starts, run `npm run extract` so graces get `entity` (needed by #72's last-grace import).

### docs/rerank-and-architecture

- Task: rerank all open work by milestone, and trim `docs/architecture.md` and fix its stale parts (the player's requests, 2026-10-20; no issue). Resolves P-14.
- PR: none yet; waiting for the player's approval to push and open it.
- Code checkpoint: docs only, on 997afd0.
- State: the rerank is done on GitHub. Milestones have theme names without numbers (OBS viewer, MCP server, Item locations, Live playthrough, Route editing, Prerequisites, Quality); UI redesign and #22 are closed; every open issue has a milestone. This branch rewrites Ranked work in that order. `docs/architecture.md` drops from about 5,900 to 3,700 words: Design keeps the model and the rules that span files, interface details (sizes, timings, wording) and history are gone, unbuilt routing parts are marked as planned, and 9 stale spots are fixed (milestones, "another playthrough", the seed's file name, MSB parsing done, path types gone, boss positions, the live-position decision, map version 4).
- Verification: Prettier passes on both files; lint, typecheck, tests and build not run (Markdown only).
- Next action: resolve P-17, then start #14.
- **P-17** Push `docs/rerank-and-architecture` and open its PR against `main`. Blocks nothing.

## Ranked work

Grouped by milestone, in order (GitHub doesn't sort milestones by rank; this list does).

**OBS viewer**

1. #14 Port the viewer from the old project

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

22. #3 Add end-to-end browser tests
23. #7 Check English and zh-TW together

## Pending

Nothing.
