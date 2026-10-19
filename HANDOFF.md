# Handoff

## In progress

### feat/auto-import

- Task: #18 Re-import progress automatically when the game saves (player's answers on the issue, 2026-10-19)
- PR: opened with P-10 approval right after this commit (Closes #18; branch not linked to the issue)
- Code checkpoint: d8067af
- State: built. The app polls `/api/save/stamp` (mtime and size) every 3 s and re-imports graces and map bosses when it changes, quietly with a toast; a renamed slot pauses and asks. On by default (player schema 12); its switch, with status and explanation, is in the progress card and the ☰ menu. Item pickups are left out on purpose (key items shouldn't reach the tracker); the character's position moved to #66.
- Verification: lint, typecheck, `npm test` (148) and build pass at d8067af. Checked in the browser with a scratch data folder and a scratch copy of the player's save (`ROUTE_OF_GRACE_SAVE_DIR`): touching the copy re-marked a grace un-marked by hand, with the toast; switched off, nothing imported. The renamed-slot prompt is covered by tests only.
- State of review: awaiting review and merge.
- Next action: address review on the PR.

## Ranked work

1. #18 Re-import progress automatically when the game saves (PR from `feat/auto-import` awaiting review)
2. #66 Show the character's position from the save on the map (spike first; `needs-decision`: three questions on the issue)
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
