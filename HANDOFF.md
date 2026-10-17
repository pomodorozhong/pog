# Handoff

## In progress

### feat/uniform-paths

- Task: #38 One uniform path with appearance, note and show-note options (decisions recorded on the issue)
- PR: #49 open for review (Closes #38), awaiting the player's review; description updated for the follow-up
- Code checkpoint: 295a490 (pushed)
- State: follow-up (pushed) built on the player's request: no Teleport option (a hop between layers is a waygate jump, drawing continues across layers on one path), new paths colored by step, shown note under the step number. Maps go to schema v4, upgrading the v3 files the PR's first build saved (the player's real data is v3 since trying the PR).
- Verification: lint, typecheck, test (88), build pass; browser check on a fresh copy of the player's data at 1400px (v3 files load and save as v4, colors white/red/blue for steps 3–5, a path across layers draws as one path with the jump pin marked, editor has no Teleport box, notes under numbers). The player's dev servers on ports 5173/5174 run this checkout on real data and hot-reload edits.
- Next action: player reviews #49; address review comments. After it merges, the next session removes this subsection

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