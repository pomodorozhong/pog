# Handoff

## In progress

### feat/walked-items-wishlist

- Task: #55 Items on a walked path join the wishlist (option 2 chosen by the player: only items on pins a walked path goes through; derived from the map until changed, so path edits never rewrite saved wishlist data)
- PR: none yet; branch pushed and linked to #55
- Code checkpoint: a33abd9 `feat: items on a walked path join the wishlist`
- State: done and committed. `combinedWishlist` in `src/wishlist/wishlist.ts` adds joined items after the saved ones; the route list, next stops, wishlist card, pin details and header count read it; `updateWishlistItem` saves a joined item when it changes. Joined items show "On a walked path" instead of Remove.
- Verification: `npm run lint`, `npm run typecheck`, `npm test` (19 files, 117 tests), `npm run build` and Prettier all pass. In the dev server on a copy of the player's data, the Golden Seed on step 2 joined the route list, showed the tag, and was saved once marked Skipped.
- Next action: on approval of P-02, push and open the PR
- Pending: P-02 push `a33abd9` plus this handoff commit and open the PR (title and body shown in chat), which blocks review and merge.

## Ranked work

1. #55 Items on a walked path join the wishlist (done on feat/walked-items-wishlist; PR awaiting approval, P-02)
2. #41 Edit a selected path (insert a node between two others)
3. #16 Extract boss-beaten flags, with boss names in the catalog (must come before #52: the catalog has no bosses yet)
4. #52 Link bosses to any pin or grace (needs #16's boss extraction)
5. #43 Choose where the save file is (blocks trying the save import)
6. #37 Grace icons cover path numbers and lines
7. #44 Show which way a path goes
8. #33 Step numbers pinned to the screen edge can overlap (small)
9. #36 Layer summary misses paths drawn only through graces (small)
10. #48 Spike: waygate locations and destinations from game data
11. #19 Bring over chosen paths from another map, with a preview
12. #22 Note what feels awkward (all ten flows tried; keep adding notes)
13. #6 Save import review shows "Apply" when nothing changed (small)
14. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
15. #8 Spike: item locations from map layout files or community sources (no UI, so it can run before M5)
16. #3 Add end-to-end browser tests
17. #7 Check English and zh-TW together

## Pending

None.
