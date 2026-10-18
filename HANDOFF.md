# Handoff

## In progress

### feat/boss-flags

- Task: #16 Extract boss-beaten flags, with boss names in the catalog (next in Ranked work; must come before #52)
- PR: none; branch is local only, created from `main` at 36ac071, not pushed or linked to #16
- Code checkpoint: 36ac071 (no work commits yet)
- State: not started. This branch so far carries only the handoff after #58 merged.
- Next action: propose #16 to the player, then plan the extraction (`scripts/extract/README.md`)
- Pending: P-02 link this branch to #16 and push it, which blocks resuming from another computer.

## Ranked work

1. #16 Extract boss-beaten flags, with boss names in the catalog (must come before #52: the catalog has no bosses yet)
2. #52 Link bosses to any pin or grace (needs #16's boss extraction)
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
16. #8 Spike: item locations from map layout files or community sources (no UI, so it can run before M5)
17. #3 Add end-to-end browser tests
18. #7 Check English and zh-TW together

## Pending

- P-01: delete the local branches `feat/desktop-layout`, `feat/graces-like-pins`, `feat/walked-items-wishlist` and `feat/wishlist-per-pin`. Their PRs (#54, #53, #56, #58) are squash-merged, so only their step commits would be lost locally (`feat/wishlist-per-pin` also holds an unpushed wrap-up commit, `96952d8`, replaced by this branch's handoff). Needs the player's OK because deleting branches is hard to undo; blocks nothing.
