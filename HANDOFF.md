# Handoff

## In progress

### feat/boss-links

- Task: #52 Link bosses to any pin or grace
- PR: none; branch created from `main` at caee934 (after #62), linked to #52 and pushed
- Code checkpoint: 70633c9 (`fix: draw the boss marker as a symmetric skull icon`), after f0da85a (`feat: link bosses to any pin or grace`)
- State: built: a `bosses` list on pins and graces, the pin details' Bosses card (search by any health bar's name with the nearest grace to tell same-named bosses apart, add, remove, reorder, Beaten tag), the skull pin and badge on the map, drawn as an SVG skull after the player found the ☠ glyph lopsided and unreadable (faded once every boss there is beaten), grace bosses merged on profile import, zh-TW strings and `docs/architecture.md`. Not done, by choice: reorder for items, boss suggestions by position.
- Verification: lint, typecheck, `npm test` (132 passed), build, Prettier; in the app against the real catalog with a scratch data folder: bosses added to a grace and to a pin, reordered, the map badge and skull pin (also checked at 3×), and the faded skull after setting Margit's flag. The only console error is the missing favicon, which isn't from this change.
- Next action: the PR (`Closes #52`) awaits the player's approval to push and open

## Ranked work

1. #52 Link bosses to any pin or grace
2. #60 Turn the item progress view into a playthrough progress tracker with bosses (needs #52; needs-decision)
3. #43 Choose where the save file is (blocks trying the save import)
4. #37 Grace icons cover path numbers and lines
5. #44 Show which way a path goes
6. #33 Step numbers pinned to the screen edge can overlap (small)
7. #36 Layer summary misses paths drawn only through graces (small)
8. #59 Color the item progress view's step badges like their paths (small)
9. #48 Spike: waygate locations and destinations from game data
10. #41 Edit a selected path (insert a node between two others)
11. #19 Bring over chosen paths from another map, with a preview
12. #22 Note what feels awkward (all ten flows tried; keep adding notes)
13. #6 Save import review shows "Apply" when nothing changed (small)
14. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
15. #3 Add end-to-end browser tests
16. #7 Check English and zh-TW together

## Pending

None.
