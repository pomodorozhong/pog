# Handoff

## In progress

### feat/item-location-spike

- Task: #8 Spike: item locations from the map layout files (`map/mapstudio/*.msb` treasure entries), and per its comment, compare community sources of item coordinates and recommend one
- PR: none; branch is local only, created from `main` at 1e20883 (after #61), not pushed or linked to #8
- Code checkpoint: 8cca077 (`feat(extract): report item locations from map layout treasures`)
- State: done, awaiting push and PR. `read_msb_treasures` (`scripts/extract/formats.py`), the `ItemLotParam_map` layout, and `scripts/extract/item_locations_report.py`: 3,466 of 5,410 map item lots get a position, placing 999 of the 1,838 catalog items found in map lots. Findings, the community source comparison and the recommendation (game data: MSB treasures, then boss drops and enemy parts) are in `docs/architecture.md`; the handoff note is on #8.
- Verification: report run against the Steam install (all 3,575 spots on the map, median 74 px from a grace; spot checks listed in the docs); `npm run extract` leaves `catalog.json` unchanged; lint, typecheck, `npm test` (126 passed), build, Prettier.
- Next action: once P-01 is approved, push and open the PR with the `open-pr` skill (`Closes #8`)
- Pending: P-01 link this branch to #8 and push it, which blocks resuming from another computer.

## Ranked work

1. #8 Spike: item locations from map layout files or community sources (moved up by the player)
2. #52 Link bosses to any pin or grace
3. #60 Turn the item progress view into a playthrough progress tracker with bosses (needs #52; needs-decision)
4. #43 Choose where the save file is (blocks trying the save import)
5. #37 Grace icons cover path numbers and lines
6. #44 Show which way a path goes
7. #33 Step numbers pinned to the screen edge can overlap (small)
8. #36 Layer summary misses paths drawn only through graces (small)
9. #59 Color the item progress view's step badges like their paths (small)
10. #48 Spike: waygate locations and destinations from game data
11. #41 Edit a selected path (insert a node between two others)
12. #19 Bring over chosen paths from another map, with a preview
13. #22 Note what feels awkward (all ten flows tried; keep adding notes)
14. #6 Save import review shows "Apply" when nothing changed (small)
15. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
16. #3 Add end-to-end browser tests
17. #7 Check English and zh-TW together

## Pending

- P-02: delete the local branch `feat/boss-flags`. Its PR (#61) is squash-merged, so only its step commits would be lost locally. Needs the player's OK because deleting branches is hard to undo; blocks nothing.
