# Next sessions

1. **Clarify it** before starting milestone 5 (UI redesign). Ask the player:
   - Having used milestone 4, what bothers them most in the current UI? (Candidates are listed under milestone 5 in [docs/plan.md](../docs/plan.md).)
   - Should the side panel become tabs (playthrough / wishlist / route), or should something else be the main screen, such as the route?
   - What stream resolution must the map be readable at (for the OBS viewer, milestone 8)?
   - Do they want a hook that blocks `git commit` on `main`, beyond the commit skill?
     Done when the answers are recorded in the plan's milestone 5 section.
2. **First run on the player's real data.** With their go-ahead, open the app on the real data folder: `player.json` upgrades from version 1 to 6, `map.json` moves to `maps/profile-1.json`, then add graces and import progress from "Burning". Done when it loads without a recovery notice and the import shows the expected graces.
3. **Milestone 5: UI redesign** on a `feat/ui-redesign` branch, following the answers from item 1. Done when the plan's milestone 5 checklist is ticked and a PR is open.
4. **Tune route costs** from play (`src/routing/route.ts` speeds and fixed costs). Done when the player agrees the "Next stops" times feel right.
