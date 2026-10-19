# Handoff

## In progress

### feat/auto-import

- Task: #18 Re-import progress automatically when the game saves (player's answers on the issue, 2026-10-19)
- PR: #67 (open, ready for review; Closes #18; branch not linked to the issue). The retry fix and this handoff are pushed to it with P-11 approval.
- Code checkpoint: d0b898a
- State: built. The app polls `/api/save/stamp` (mtime and size) every 3 s and re-imports graces and map bosses when it changes, quietly with a toast listing only what changed; it only adds graces (never removes them), while bosses follow the save; a renamed slot pauses and asks; only a checksum mismatch is retried at once, other failures wait for the save to change. On by default (player schema 12); its switch, with status and explanation, is in the progress card and the ☰ menu. Item pickups are left out on purpose (key items shouldn't reach the tracker); the character's position moved to #66.
- Verification: lint, typecheck, `npm test` (151) and build pass at d0b898a. Checked in the browser with a scratch data folder and a scratch copy of the player's save (`ROUTE_OF_GRACE_SAVE_DIR`): touching the copy re-marked a grace un-marked by hand, with the toast; switched off, nothing imported. The renamed-slot prompt is covered by tests only.
- State of review: awaiting review and merge.
- Next action: the player merges #67, ideally after trying it with the real game. After the merge: update the milestones (the player is choosing between unnumbered names for the new save-related one, for all of them, or renumbering; recommended: no numbers) with one for #69, #68, #66, #6, #27 and maybe #44, then re-rank.

## Ranked work

1. #18 Re-import progress automatically when the game saves (PR #67 awaiting merge)
2. #69 Set "I'm here" from the last grace rested at in the save (live position isn't viable: the game saves too rarely)
3. #68 Focus mode that shows only the current path (open questions on the issue)
4. #44 Show which way a path goes (now with the idea to animate only the path leaving the last grace; uses #69)
5. #66 Show the character's position from the save on the map (lags behind the character; spike first; `needs-decision`)
6. #37 Grace icons cover path numbers and lines
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

None.
