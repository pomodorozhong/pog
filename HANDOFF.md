# Handoff

## In progress

### feat/desktop-layout

- Task: #46 Rework the full-size layout, with #45 (wishlist find and search) and #42 (simpler playthrough panel); one PR closing all three. Mockup approved by the player (Desktop layout mockup artifact), then the detailed plan.
- PR: #54 (open, awaiting the player's review)
- Code checkpoint: the First Step start-position commit (pushed)
- State: built. One layout at every width from the narrow layout's parts: goal line as header and switcher, Undo/Redo and ☰ menu (path numbers, language) at its right; New playthrough… (optional template) is the switcher's last choice; round map buttons and layer pill everywhere; from 640px up the tools are pills on the map (icons only below 1024px) and the hint is bottom right, below 640px the edit toolbar row stays. Side panel is the bottom sheet as a 384px column: walk list with search (name in either language, pin label or grace name, note) and status filter; an Edit / Done button switches to Edit, and any selection does too. Edit with nothing selected: one card per topic (playthrough with read-first goal and pencil, progress with save import, next-stop timeline, wishlist with notes folded, this map with layer counts and import), then Delete on its own. New playthroughs start at The First Step (START_POSITION, grace/61423601). Node and path details as cards with a close button, segmented Kind, inline label/note, switches. `.chip` is now a soft pill app-wide; new `.segmented`, `.card`, `.popover`, `.map-pill`, `.inline-field`, `.switch`.
- Verification: lint, typecheck, test (113, including new tests/app-layout.test.tsx), build, Prettier pass. Browser check on an empty scratch data folder at 1280, 960 and 375px: header, map pills, list with the 46-item template (search "盾" finds the shields), Edit cards, grace details, narrow edit toolbar, zh-TW; no console errors.
- Checks not run: not checked on a copy of the player's real data; Next stops with a planned route and the save import flow only seen empty.
- Deviation from the plan: the wishlist editor in Edit is folded behind "Notes and status" so the panel stays short (the list mode shows the wishlist).
- Next action: player reviews the PR closing #46, #45 and #42; address review comments

## Ranked work

1. #46 + #45 + #42 One layout at every width, with wishlist search and a simpler playthrough panel (in progress on feat/desktop-layout)
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
