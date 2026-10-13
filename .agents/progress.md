# Progress

## Current state

- Branch `main` (`4b2c9a5`): milestones 1–4 of [docs/plan.md](../docs/plan.md) are done and pushed. On 2026-10-13 the history was rebuilt into 9 commits, one per PR-sized change, and force-pushed as the new `main`.
- Works: map editor, game graces, playthrough profiles with their own maps, wishlist (with the Great Stars Guard Counter template), progress and "Import progress from save" (graces only), routing rules, route planning, detour estimate, "Next stops" with the route drawn on the map.
- Not tested on real data: the player's own data folder hasn't been opened by the new version (it upgrades `player.json` from version 1 to 6 on first load). The save import was tested read-only against a copy of the real save (slot 1 "Burning": 140 graces).
- Route costs are first guesses, not tuned by play.

## Session log

### 2026-10-13

- Done: all of milestone 4 (wishlist, seed template, progress, save import, routing rules, shortest paths, visit order and detour, Next stops). 45 unit tests. Details in [docs/progress/2026-10-13.md](../docs/progress/2026-10-13.md).
- Decided: follow the plan as written (no automatic save watching). The event-flag block table is downloaded by `npm run extract` from ER-Save-Lib at a pinned commit (unlicensed, so not committed). Item and boss flags wait (milestone 6 / when routing needs "Blocked by X"). Git: never commit on `main`; branches with step commits, squash-merged PRs.
- Learned: the save's flag table can't be derived from game files. JavaScript's `&` is signed (`>>> 0` needed for handle masks). Straight-line guesses must not undercut drawn paths, so they only bridge unconnected pieces. Filenames that differ only in case clash on macOS.
