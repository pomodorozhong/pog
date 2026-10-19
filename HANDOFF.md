# Handoff

## In progress

### feat/playthrough-tracker

- Task: #60 Turn the item progress view into a playthrough progress tracker with bosses
- PR: not opened; branch linked to #60 (P-05 approved), pushed only at 97eb225
- Code checkpoint: af52f10 (not pushed)
- State: built and reviewed by the player; awaiting P-06. The side panel's list is the "Playthrough tracker" (「挑戰進度」): wishlist entries plus every boss on a pin or grace a walked path reaches, bosses before items at each pin, tap to mark beaten (sets the boss's flag). Header: "{acquired} of {total} items acquired", plus " · {beaten} of {bosses} bosses beaten" once the walk reaches a boss. The filter reads To do / Done / Skipped; Done holds acquired items and beaten bosses. The save import only asks about bosses on the map's pins and graces. `docs/architecture.md` updated.
- Verification: lint, typecheck, `npm test` (135) and build pass at af52f10; checked in the browser in English and zh-TW against a scratch data folder (seeded map, boss toggled, no console errors).
- Player decisions on the review (name, hidden empty boss count, to-do filter) are built.
- Next action: on P-06 approval, push and open the PR with the drafted title and body.
- Pending: P-06 push this branch and open its PR "feat: turn the item progress view into a playthrough tracker with bosses" (Closes #60); asked 2026-10-19, blocks review and merge.

## Ranked work

1. #60 Turn the item progress view into a playthrough progress tracker with bosses (the player's decisions are in a comment on #60)
2. #43 Choose where the save file is (blocks trying the save import)
3. #37 Grace icons cover path numbers and lines
4. #44 Show which way a path goes
5. #33 Step numbers pinned to the screen edge can overlap (small)
6. #36 Layer summary misses paths drawn only through graces (small)
7. #59 Color the item progress view's step badges like their paths (small)
8. #48 Spike: waygate locations and destinations from game data
9. #41 Edit a selected path (insert a node between two others)
10. #19 Bring over chosen paths from another map, with a preview
11. #22 Note what feels awkward (all ten flows tried; keep adding notes)
12. #6 Save import review shows "Apply" when nothing changed (small)
13. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
14. #3 Add end-to-end browser tests
15. #7 Check English and zh-TW together

## Pending

None.
