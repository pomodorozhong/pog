# Handoff

## In progress

### feat/save-location

- Task: #43 Choose where the save file is, then #18 (re-import automatically when the game saves) on its own branch
- PR: none; branch local only, from `main` at 51956a6 (after #64), not pushed or linked to #43
- Code checkpoint: 2507ef2
- State: built; awaiting P-08. This machine's save is in Steam's own prefix (`~/Library/Application Support/Steam/steamapps/compatdata/1245620/pfx/.../EldenRing`), not a bottle, and the game is in Steam's own library. The server now searches every CrossOver bottle plus that prefix; picking a character remembers its file as `saveLocation` (player schema 11); "Choose another location" takes a typed full path; nothing found lists where it looked. The extractor finds the game in Steam or any bottle.
- Verification: lint, typecheck, `npm test` (141) and build pass at 2507ef2; `extract.py` compiles and finds the game, but a full `npm run extract` wasn't run. Real import checked in the browser against the player's save (5 characters found, slot 1 read, +143 graces), with a scratch data folder.
- Next action: on P-08 approval, push and open the PR with the drafted title and body. Then #18, whose questions are with the player.
- Pending: P-08 push this branch and open its PR "feat: find the save in every bottle and Steam, and choose its location" (Closes #43); asked 2026-10-19, blocks review and merge. It replaces P-07 (link and push): the PR links the branch to #43.

## Ranked work

1. #43 Choose where the save file is (blocks trying the save import; in progress on `feat/save-location`)
2. #18 Re-import progress automatically when the game saves (after #43; the player wants it, and its questions are with the player)
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
