# Handoff

## In progress

### feat/graces-like-pins

- Task: #51 Graces work like pins: label, entrance, items (plan approved by the player)
- PR: none yet; awaiting the player's approval to push and open it
- Code checkpoint: 094e6d6 (local only, not pushed)
- State: built. Game graces take a label (beside the official name), Kind Grace or Entrance (its place in a new `place` field, since a grace's `ref` stays its grace ID) and items. Stored in the map's optional `graces` object by grace ID, only while set; merged onto graces by `withGameGraces`. A grace with items keeps its marker and shows the first item's icon as a badge with "+N"; a grace with a label, entrance or items stays visible when unused graces are hidden. Import merges grace items and fills a missing label or entrance. Maps stay at schema v4.
- Verification: lint, typecheck, test (108), build pass. Browser check at 800px on an empty scratch data folder: label, entrance and two items on a grace; badge and "+1" don't overlap; grace stays shown with "Hide graces without paths" on and nothing selected; reload keeps everything; saved file holds only `graces`; zh-TW panel reads correctly; no console errors.
- Checks not run: not checked on a copy of the player's real data (copying it was blocked); import between two profiles checked only by tests.
- Branch link: not linked to #51 on GitHub yet; link when pushing (`gh issue develop` would create the remote branch).
- Next action: player approves the push and PR, then address review comments

## Ranked work

1. #51 Graces work like pins: label, entrance, items (in progress on feat/graces-like-pins)
2. #41 Edit a selected path (insert a node between two others)
3. #45 Make the wishlist easy to find and search
4. #46 Rework the full-size layout (#42 and #45 are parts of it)
5. #16 Extract boss-beaten flags, with boss names in the catalog (must come before #52: the catalog has no bosses yet)
6. #52 Link bosses to any pin or grace (needs #16's boss extraction and #51)
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
