# Handoff

## In progress

Five branches are built together on the local stack branch `stack/last-grace-and-map-readability` and will be published as one PR each against `main`. All five are independent: each is `main` (703e207) plus its own commits, and each can be squash-merged on its own. PRs 2 and 3 both edit `src/map/MapCanvas.tsx`; they apply cleanly in either order. Only `feat/last-grace-from-save` carries `HANDOFF.md`.

### feat/last-grace-from-save

- Task: #69 Set "I'm here" from the last grace rested at in the save
- PR: not opened yet (P-15 in the stack subsection); Closes #69. Branch not linked to the issue.
- Code checkpoint: 703e207 plus this branch's feature commit and two review fixups (graces follow the save; planned route no longer drawn)
- State: built. The slot stores the last grace right after the tutorials as `bonfireEntityId` + 1000 (checked on the player's three characters: Palace Approach Ledge-Road, Gatefront, Tombsward Cave). The extractor writes `entity` per grace; the import keeps `lastGrace` in progress and moves the position only when it changes. Needs `npm run extract` again after merging. Review feedback (2026-10-20) applied: the automatic import now follows the save for graces too (a hand-marked grace the save lacks is cleared), the review summary drops zero counts, and the planned route's light-blue lines, stop badges and forced names are no longer drawn (the player routes by hand and it led into dead ends; the "Next stops" list stays).
- Verification: lint, typecheck, `npm test` and build pass on the rebuilt branch. In the browser with a scratch copy of the player data, the automatic import read the real save (read-only) and moved "I'm here" to Tombsward Cave; a position set by hand stayed through the next import.
- Next action: the player reviews the built stack; after their final approval, publish it from `stack/last-grace-and-map-readability`.

### feat/path-direction

- Task: #44 Show which way a path goes
- PR: not opened yet (P-15 in the stack subsection); Closes #44.
- Code checkpoint: 703e207 plus this branch's feature commit and four fixups (moving arrows; they keep moving while the player is on the path; the current path at a shared pin, and no lag while zooming; pausing them while zooming)
- State: built. Still chevrons every 90 screen px along every path; on the current path (among paths through "I'm here", the lowest step with something left to do: undiscovered grace, unbeaten boss or needed wishlist entry; else the lowest step partway along or starting there) larger outlined arrows move along it with CSS `offset-path` at 60 px/s (review fixup 2026-10-20: the first version's wave of light was too subtle); paused as still arrows from a zoom's first frame until it ends (re-placing them every frame flashed); reduced motion keeps them still.
- Verification: checks pass on the rebuilt branch; arrows and the moving wave checked in the browser.
- Next action: the player reviews the built stack; after their final approval, publish it from `stack/last-grace-and-map-readability`.

### feat/step-badge-colors

- Task: #59 Color the item progress view's step badges like their paths (PR retitled "Color step numbers like their paths, in the tracker and on the map"; reword the squash commit at push)
- PR: not opened yet (P-15 in the stack subsection); Closes #59.
- Code checkpoint: 703e207 plus this branch's feature commit and a fixup coloring the map's step numbers
- State: built; badges, and the map's step numbers (review 2026-10-20), take the path color with dark text (contrast 5.5:1 or more on every color).
- Verification: checks pass on the rebuilt branch; badge colors checked in the browser against the map.
- Next action: the player reviews the built stack; after their final approval, publish it from `stack/last-grace-and-map-readability`.

### fix/layer-summary-grace-paths

- Task: #36 Layer summary misses paths drawn only through graces
- PR: not opened yet (P-15 in the stack subsection); Closes #36.
- Code checkpoint: 703e207 plus this branch's fix commit
- State: built; the "This map" card counts a grace-only path.
- Verification: checks pass on the rebuilt branch; checked in the browser (5 → 6 paths with a grace-only road added).
- Next action: the player reviews the built stack; after their final approval, publish it from `stack/last-grace-and-map-readability`.

### fix/step-number-overlap

- Task: #37 Path numbers get covered by grace icons, and #33 Step numbers pinned to the screen edge can overlap
- PR: not opened yet (P-15 in the stack subsection); Closes #37 and #33.
- Code checkpoint: 703e207 plus this branch's fix commit and a doc fixup (the Steps note drops the planned route's stop numbers)
- State: built. A covered number slides along its path to a clear spot 4 px from the icon, or goes beside it; edge-pinned numbers spread along the edge; Move… highlights the moved path at once.
- Verification: checks pass on the rebuilt branch; the #37 Church of Elleh reproduction checked in the browser (number and grace each clickable). The edge spread is covered by unit tests only.
- Next action: the player reviews the built stack; after their final approval, publish it from `stack/last-grace-and-map-readability`.

### stack/last-grace-and-map-readability

- Task: build the five PRs below together, then publish each as its own branch from `main` (the `propose-stack` skill). Local only; this branch is never pushed.
- PR: none for this branch. The PR map (base, commits per PR, trial tree hashes) and the five PR bodies are in `.agents/propose-stack/last-grace-and-map-readability/` (`pr-map.md`, `review.md`, `body-1.md` … `body-5.md`), kept out of git by `info/exclude`.
- Code checkpoint: base 703e207; one contiguous run of commits per PR, in stack order: PR 1 (feature + this handoff), PR 2, PR 3, PR 4, PR 5. Fold review fixes in as `fixup!` commits of the PR they belong to.
- State: built; the player's review feedback (2026-10-20) is folded into PRs 1, 2, 3 and 5, and the final review was shown (2026-10-20). Earlier open points were the "details to check" (the save's +1000 offset, `lastGrace` with no schema bump, the Ashen twin mapping, the zh-TW strings, the arrow wave and the lowest step only, PR 3 avoiding every pin, spreading rather than merging edge numbers) and the PR text.
- Verification: the trial rebuild put each PR alone on 703e207, and lint, typecheck, `npm test` and build passed for each (154, 160, 157, 152 and 153 tests; all five re-run 2026-10-20 after folding the fixups). PRs 1, 2, 3 and 5 all edit `MapCanvas.tsx` and PRs 1 and 2 `App.tsx`; every pair with PR 2 or PR 5 applies, and four full orders give the stack tip's tree. The tree hashes are in the PR map. Re-run the trial rebuild after any change.
- Next action: wait for the player's answer to "Push these 5 branches and open the PRs?" (P-15). More feedback goes in as fixups, folded in, with the trial rebuild re-run and the review shown again.
- **P-15** Push `feat/last-grace-from-save`, `feat/path-direction`, `fix/step-number-overlap`, `fix/layer-summary-grace-paths` and `feat/step-badge-colors` (each rebuilt from 703e207 to its recorded tree), and open one PR each against `main` with the approved bodies. Needs the review first, then its own approval. Blocks resuming from another computer and merging any of the five.

## Ranked work

1. #68 Focus mode that shows only the current path (`needs-decision`: open questions on the issue)
2. #66 Show the character's position from the save on the map (lags behind the character; spike first; `needs-decision`)
3. #6 Save import review shows "Apply" when nothing changed (small; after #69 merges, since it edits the same review)
4. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns; after #69 merges)
5. #70 Zoom to fit the current path when the automatic import changes it (`needs-decision`; after #69 and #44 merge)
6. #48 Spike: waygate locations and destinations from game data
7. #41 Edit a selected path (insert a node between two others)
8. #19 Bring over chosen paths from another map, with a preview
9. #71 Make the mobile bottom sheet behave and look like an iOS sheet (`needs-decision`)
10. #22 Note what feels awkward (all ten flows tried; keep adding notes)
11. #3 Add end-to-end browser tests
12. #7 Check English and zh-TW together

## Pending

- **P-13** Delete the local branches whose PRs merged or that are superseded: `feat/save-location` (#65), `feat/playthrough-tracker` (#64), `feat/auto-import` (#67), and `feat/last-grace-position` (only a handoff commit; replaced by `feat/last-grace-from-save`). Their only commits missing from main are the pre-squash step commits and handoff notes. Local only; nothing on GitHub changes. Blocks nothing.
- **P-14** Update the milestones: the player is choosing between theme names without numbers for a new save-related milestone only, for all milestones, or renumbering (recommended: no numbers). Then add that milestone for #68, #66, #6, #27, and re-rank. Blocks the milestone cleanup the player asked for after #67 merged.
