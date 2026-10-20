# Testing

- **Unit tests** (`npm test`, Vitest): `tests/*.test.ts(x)`. The app tests render the real components with the Leaflet map replaced by buttons, and need no game data.
- **End-to-end tests** (`npm run test:e2e`, Playwright): `tests/e2e/*.spec.ts`, in headless Chromium against the real app, map included. Install the browser once with `npx playwright install chromium`.

## End-to-end tests

- They start two servers: the dev server on port 5198 and a built preview on 5199. Both save into one disposable `pog-e2e-*` folder in the system temporary folder (through `POG_DATA_DIR`), so they never touch the player's own data. The config refuses any other folder, and the folder is deleted afterwards.
- Every test starts with an empty folder and a `player.json` with the import from the save turned off, so a save on this computer never changes what a test sees.
- They need the extracted game data (`npm run extract`), which stays out of git. Without it every test is skipped with that message.
- Tests check both the screen and the saved files (`saved("player")`, `saved("maps/<profile id>")` in `tests/e2e/fixtures.ts`). Map clicks are positions from the center of the map (`tests/e2e/app.ts`); keep them clear of graces.
- `mirror.spec.ts` opens the mirror in its own browser context, as OBS is, and checks that it follows the app and never sends a request or WebSocket frame.
- `agent.spec.ts` calls the tools as the MCP server does (`callApp` in `server/mcp.ts`) and applies the proposal in the app.
- Run one spec with `npx playwright test flows`, or watch it with `--headed`. Failures leave traces in `test-results/` (ignored by git).
