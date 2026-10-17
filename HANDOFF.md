# Handoff

## In progress

### feat/uniform-paths

- Task: #38 One uniform path with appearance, note and show-note options (decisions recorded on the issue)
- PR: opened for review (Closes #38); awaiting review and merge
- Code checkpoint: d36d789 (pushed)
- State: built. Paths have a look (8 colors, solid/dashed), note with "show on map", one way, and teleport (locked on for paths between layers). Routing is by distance, no time estimates; the avoid list is gone. Maps upgrade to v3, player.json to v10.
- Verification: lint, typecheck, test (87), build pass; checked in the browser on a copy of the player's data at 1400px (upgrade keeps paths gold, editor options, note on map, one-way arrow, cross-layer drawing makes a locked teleport, real data untouched). Next stops and the pin hint without times are covered by typecheck only: the player's data has no needed pinned items.
- Next action: player review of the PR, including Next stops without minutes on a map with pinned wishlist items; address comments, then merge when accepted

## Ranked work

1. #38 One uniform path with look, note and routing options (PR awaiting review)
2. #40 One pin tool; items attach to any node (reshapes nodes before #39 and #10)
3. #41 Edit a selected path (insert a node between two others)
4. #39 Notes on any pin, optionally shown on the map
5. #45 Make the wishlist easy to find and search
6. #46 Rework the full-size layout (#42 and #45 are parts of it)
7. #42 Simpler playthrough panel
8. #43 Choose where the save file is (blocks trying the save import)
9. #37 Grace icons cover path numbers and lines
10. #44 Show which way a path goes
11. #33 Step numbers pinned to the screen edge can overlap (small)
12. #36 Layer summary misses paths drawn only through graces (small)
13. #48 Spike: waygate locations and destinations from game data
14. #19 Bring over chosen paths from another map, with a preview
15. #22 Note what feels awkward (all ten flows tried; keep adding notes)
16. #6 Save import review shows "Apply" when nothing changed (small)
17. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
18. #8 Spike: item locations from map layout files or community sources (no UI, so it can run before M5)
19. #3 Add end-to-end browser tests
20. #7 Check English and zh-TW together

## Pending

None.