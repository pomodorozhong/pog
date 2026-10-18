# Handoff

## In progress

### feat/wishlist-per-pin

- Task: #57 Wishlist entries per pin, so copies of an item count separately (the player's decisions are on #57)
- PR: open against `main`, awaiting review; it closes #57, and the branch is linked to #57
- Code checkpoint: a9807e5 `feat: wishlist entries per pin, so copies of an item count separately`
- State: done and committed. Entries carry an optional `pin`; `combinedWishlist` in `src/wishlist/wishlist.ts` returns `pinned` (saved entries whose pin holds the item, then joined ones) and `unpinned`. The item progress, next stops and header count read `pinned` only. Unpinned entries show in the wishlist card and in a pin's item editor (`UnpinnedPicker`), which attaches them. Old wishlists load unchanged, with a warning where a pin already holds the item. No schema version bump.
- Verification: `npm run lint`, `npm run typecheck`, `npm test` (19 files, 124 tests), `npm run build` and Prettier on changed files all pass (`server/store.ts` and `tsconfig.json` fail Prettier on `main` already). In the dev server on a copy of the player's data: separate Sacred Tear rows per pin, the old-entry warning, the search marker, attaching Carian Slicer from its pin (saved with its pin, map unchanged), taking the item off the pin moving the entry to the no-pin list, and Undo attaching it again.
- Next action: player reviews the PR, including the reviewer follow-up steps (marking one of two copies; adding from search)

## Ranked work

1. #57 Wishlist entries per pin, so copies of an item count separately (started on feat/wishlist-per-pin; needs-decision)
2. #16 Extract boss-beaten flags, with boss names in the catalog (must come before #52: the catalog has no bosses yet)
3. #52 Link bosses to any pin or grace (needs #16's boss extraction)
4. #43 Choose where the save file is (blocks trying the save import)
5. #37 Grace icons cover path numbers and lines
6. #44 Show which way a path goes
7. #33 Step numbers pinned to the screen edge can overlap (small)
8. #36 Layer summary misses paths drawn only through graces (small)
9. #48 Spike: waygate locations and destinations from game data
10. #41 Edit a selected path (insert a node between two others)
11. #19 Bring over chosen paths from another map, with a preview
12. #22 Note what feels awkward (all ten flows tried; keep adding notes)
13. #6 Save import review shows "Apply" when nothing changed (small)
14. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
15. #8 Spike: item locations from map layout files or community sources (no UI, so it can run before M5)
16. #3 Add end-to-end browser tests
17. #7 Check English and zh-TW together

## Pending

None.
