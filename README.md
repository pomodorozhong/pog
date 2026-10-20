# Path of Grace

A route planner for Elden Ring challenge runs.

Before the run, you set its goal, list the items you need, and draw the route on the game's map. During the run, the app reads your progress from the save and marks what's done.

## What you can do

- **Draw your route on the real map.** The Lands Between, the underground, the Land of Shadow and its underground are all fully revealed. Every Site of Grace and boss is already placed from the game's own files.
- **Keep a wishlist.** Search any of the 3,700+ weapons, armor pieces, talismans, spells and other items, with their in-game icons. Add one, pin where it is, and the route takes it into account.
- **Run several playthroughs.** Each one has its own goal, wishlist, progress and map. Start a new run from an old run's paths instead of a blank map.
- **Track progress from your save.** Point the app at your Elden Ring save and it reads which graces you've found, which bosses you've beaten and where you last rested. It can update automatically every time the game saves. It only ever reads your save and never changes it.
- **Show it on stream.** A mirror link shows exactly what's in your app window as an OBS browser source, so you keep planning in your own window while viewers see the same screen.
- **English and Traditional Chinese.** Item, place and boss names come straight from the game, in both languages.

## What you need

- A Mac, with Elden Ring installed through NotProton or CrossOver. The app reads the maps, names and icons from your own copy of the game, so nothing from the game is shipped with it.
- Spoilers are fair game: missable items and quest-lock warnings are shown openly.

## Getting started

1. `npm install`
2. `npm run extract` to read the game data from your copy of Elden Ring (see [scripts/extract/README.md](scripts/extract/README.md))
3. `npm run dev`, then open the address it prints

How it works and why: [docs/architecture.md](docs/architecture.md). All docs: [docs/README.md](docs/README.md).
