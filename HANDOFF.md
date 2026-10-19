# Handoff

## In progress

### feat/playthrough-tracker

- Task: #60 Turn the item progress view into a playthrough progress tracker with bosses
- PR: none; branch is local only, created from `main` at 6872bed (after #63), not pushed or linked to #60
- Code checkpoint: 6872bed (no work commits yet)
- State: not started. The player's decisions are in a comment on #60: every boss on a pin a walked path reaches; beaten or not, no skipped; the save import only checks bosses on the map's pins and graces; separate item and boss counts on the tracker view, no Items / Bosses filter; a name like "Playthrough tracker" (zh-TW 「遊玩進度」), to confirm when built.
- Verification: `main` at 6872bed passed lint, typecheck, `npm test` (132) and build as #63's branch; not re-run on this branch.
- Next action: propose a plan for #60 to the player
- Pending: P-05 link this branch to #60 and push it, which blocks resuming from another computer.

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
