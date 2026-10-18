# Handoff

## In progress

### feat/boss-flags

- Task: #16 Extract boss-beaten flags, with boss names in the catalog (next in Ranked work; must come before #52)
- PR: none yet; the branch is linked to #16 and pushed
- Code checkpoint: ce00b96 (`feat(extract): bosses with beaten flags, official names and positions`, then `feat: the save import marks beaten bosses`)
- State: `npm run extract` adds 211 `bosses` (of 212 `GameAreaParam` rows with a beaten flag) to `catalog.json`, with official en/zh-TW names from each map's boss health bar (`event/*.emevd`), positions projected like graces, and `otherNames` for duos and phases. The save import also asks about boss flags and lists bosses beaten / not beaten. Bosses only on this branch; item locations stay in #8.
- Verification: lint, typecheck, `npm test` (126 passed, including `tests/save-import-review.test.tsx`), build; the first commit also checked on its own (124 passed). Extractor run against the Steam install (`ROUTE_OF_GRACE_GAME_DIR`; the default bottle path is out of date, noted on #43); the app loads the new catalog without errors. Not tried: an import against a real save.
- Next action: open the PR with the `open-pr` skill (`Closes #16`)

## Ranked work

1. #16 Extract boss-beaten flags, with boss names in the catalog (must come before #52: the catalog has no bosses yet)
2. #8 Spike: item locations from map layout files or community sources (moved up by the player; separate branch from #16)
3. #52 Link bosses to any pin or grace (needs #16's boss extraction)
4. #60 Turn the item progress view into a playthrough progress tracker with bosses (needs #52; needs-decision)
5. #43 Choose where the save file is (blocks trying the save import)
6. #37 Grace icons cover path numbers and lines
7. #44 Show which way a path goes
8. #33 Step numbers pinned to the screen edge can overlap (small)
9. #36 Layer summary misses paths drawn only through graces (small)
10. #59 Color the item progress view's step badges like their paths (small)
11. #48 Spike: waygate locations and destinations from game data
12. #41 Edit a selected path (insert a node between two others)
13. #19 Bring over chosen paths from another map, with a preview
14. #22 Note what feels awkward (all ten flows tried; keep adding notes)
15. #6 Save import review shows "Apply" when nothing changed (small)
16. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
17. #3 Add end-to-end browser tests
18. #7 Check English and zh-TW together

## Pending

None.
