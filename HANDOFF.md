# Handoff

## In progress

### feat/mobile-layout

- Task: #28 Layout holds up in a narrow window (the player uses mobile size, where it's unusable)
- PR: opened for review (Closes #28); awaiting review and merge
- Code checkpoint: b9f8c6f (pushed)
- State: built, pushed, PR awaiting review. Narrow (<640px, `src/layout/useMediaQuery.ts`): the goal (large, gold) is the playthrough switcher, with constraints and a "No DLC"/avoids tag under it, ☰ menu top right (path numbers, language); zoom and map details redesigned as small round controls on the map, map layer pill at the map's bottom left, wishlist in walk order (`walkOrder` in `src/wishlist/wishlist.ts`, `WalkList`) with tap-to-mark acquired. The bottom sheet has a slim header with an edit (pencil) toggle and an expand chevron; Edit shows the toolbar and the full side panel (playthrough, wishlist, pin and path editors) so everything stays editable. Below 1024px: icon tools with key badges, hint behind "?", layer select instead of chips. Desktop unchanged.
- Verification: lint, typecheck, test (83), build pass; checked in the browser on a copy of the player's data at 400, 960 and 1400px wide (menu, layer picker, tap-to-mark, hint, Edit tab with pin selection).
- Next action: player review of the PR; address comments, then merge when accepted
- Full-size layout is out of scope here: #46

## Ranked work

1. #28 Layout holds up in a narrow window (the player uses mobile size, where it's unusable)
2. #38 One uniform path: decide how routing works without path types (blocks the path model)
3. #40 One pin tool; items attach to any node (reshapes nodes before #39 and #10)
4. #41 Edit a selected path (insert a node between two others)
5. #39 Notes on any pin, optionally shown on the map
6. #45 Make the wishlist easy to find and search
7. #46 Rework the full-size layout (after #28; #42 and #45 are parts of it)
8. #42 Simpler playthrough panel
9. #43 Choose where the save file is (blocks trying the save import)
10. #37 Grace icons cover path numbers and lines
11. #44 Show which way a path goes
12. #33 Step numbers pinned to the screen edge can overlap (small)
13. #36 Layer summary misses paths drawn only through graces (small)
14. #19 Bring over chosen paths from another map, with a preview
15. #22 Note what feels awkward (all ten flows tried; keep adding notes)
16. #6 Save import review shows "Apply" when nothing changed (small)
17. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
18. #8 Spike: item locations from map layout files or community sources (no UI, so it can run before M5)
19. #3 Add end-to-end browser tests
20. #7 Check English and zh-TW together

## Pending

None.