# Handoff

## In progress

### feat/grace-clutter

- Task: #32 Hide graces without paths (closed by the PR); #29 Review very-close grace names and Details controls (stays open until the player accepts)
- PR: #35, open and ready for review, awaiting player review and merge
- Code checkpoint: 27385c4 (application code); branch head f83dd92 is pushed
- State: Details panel (Automatic from zoom 6, On hover, Always) and a separate Hide graces without paths button on the map edge; filter toggles without flashing. Settings persist across playthroughs (player schema 9). English and zh-TW done.
- Verification: at 27385c4, lint, typecheck, 82 tests and build passed; earlier browser checks with disposable profiles covered filtering, zoom threshold, persistence and both languages. Not rerun since, because only handoff Markdown changed.
- Not checked: browser hover and final acceptance of the revised grace-name controls (hover is covered by automated tests)
- Next action: the player reviews the preview for #29; on acceptance, remove this subsection, update `Ranked work`, and merge #35
- Avoid: adding `Closes #29` to the PR before the player accepts the result

## Ranked work

1. #29 Review very-close grace names and Details controls
2. #28 Layout holds up in a narrow window
3. #33 Step numbers pinned to the screen edge can overlap (small)
4. #37 Path numbers get covered by grace icons
5. #36 Layer summary misses paths drawn only through graces (small)
6. #22 Try the main flows and note what feels awkward (keep adding notes; starts M5)
7. #6 Save import review shows "Apply" when nothing changed (small)
8. #27 Ashen Capital graces read as undiscovered (small; affects fast travel after Leyndell burns)
9. #8 Spike: parse treasure entries in the map layout files (no UI, so it can run before M5)
10. #3 Add end-to-end browser tests
11. #7 Check English and zh-TW together

## Pending

None.
