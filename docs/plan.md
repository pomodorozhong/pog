# Route of Grace: plan

Updated 2026-10-14 (UI redesign added as milestone 5). Replaces the build order in the old project's handoff note, and adds what extracting the game data taught us.

## Goal

A map-based route planner for Elden Ring (base game and Shadow of the Erdtree). The player plans and tracks several playthroughs. Each playthrough (a **profile**) has its own goal, constraints, wishlist, progress and path annotations; the app works out the actual path on that profile's map and updates it whenever the wishlist or progress changes.

**Main pain point:** planning a route to collect items, then changing it as new items worth getting are found. The old app failed because every item needed hand-curated data; anything this app needs should come from the game files or from a few clicks by the player.

## Decisions

| Topic           | Decision                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Route meaning   | A real path drawn on the map, not an ordered list of places.                                                                                                             |
| Playthroughs    | One profile is one whole route: its own goal, constraints, wishlist, progress, position, linked save slot and map annotations. Switching profiles switches all of these. |
| Map per profile | Each profile has its own nodes and paths. "Import from another profile" copies annotations across, so a new playthrough doesn't start from a blank map.                  |
| Path data       | The player draws paths in the editor. No automatic navmesh.                                                                                                              |
| Places          | Graces come from the game data. Item pins come from the game data once item locations are extracted (milestone 6); until then the player places them.                    |
| Names           | Official in-game English and zh-TW names win over any other source. Player-written text is kept as written.                                                              |
| Language        | English and Traditional Chinese (zh-TW) for all interface text.                                                                                                          |
| Spoilers        | Fine. Show missable and quest-lock warnings freely.                                                                                                                      |
| Viewer mode     | Required: a read-only URL used as an OBS browser source.                                                                                                                 |
| DLC             | In scope (separate map layers).                                                                                                                                          |
| Platform        | Mac, game running in CrossOver. Everything runs natively on macOS.                                                                                                       |
| Live position   | No. The player sets their position by hand (for example "at grace X").                                                                                                   |
| Game assets     | Generated locally by the extractor, never committed. Only the script is in git.                                                                                          |

## What the extraction taught us

Everything below comes from the player's own install, read natively on macOS in about 100 seconds (see `scripts/extract/README.md`).

**Already extracted (`game-data/`):**

- **Catalog:** 3,714 items (weapons, armor, talismans, goods, Ashes of War), 674 of them DLC, plus 419 graces, 1,007 places and 483 NPCs. Every entry has official English and zh-TW names.
  - All 46 seed wishlist items are found. 5 of the seed's zh-TW names were community translations and are replaced by the official ones.
  - Place names repeat under several IDs (region name vs. area name), so search shows each name once.
  - Goods carry a `goodsType`, which can separate spells, spirit ashes, key items and consumables later.
- **Icons:** 2,650 item icons (256 px WebP).
- **Map tiles:** fully revealed Leaflet tile pyramids for 4 layers: `overworld` (M00), `underground` (M01), `dlc` (M10), `dlc-underground` (M11). The full-resolution layers are 10,496 px square (8,704 px for `dlc-underground`), zoom 0–6.

- **Graces (milestone 3):** 419 of the 422 `BonfireWarpParam` rows, with official names, "discovered" event flags and map pixel positions (3 rows are unnamed or unreachable). Graces at boss arenas are named after the boss.
- **World-to-map transform (solved):** one transform fits every layer: map pixel = (world x − 7040, 16512 − world z), one pixel per meter. World x/z come from area 60 or 61 grid cells (`grid × 256 + position`). Graces inside legacy dungeons, caves and catacombs are moved into area 60/61 by following `WorldMapLegacyConvParam` rows, which work in both directions and sometimes chain (Deeproot → Leyndell sewers → Leyndell → overworld). Checked by eye on churches, forts and castles in the overworld, the underground and the DLC.

**Available in the game data but not yet used:**

- **`WorldMapPointParam`:** the game's own map markers, with positions and names.
- **`ItemLotParam`:** what each pickup gives and its "picked up" event flag, but no position.
- **Map layout files (`map/mapstudio/*.msb`):** readable for overworld cells (`m60_*`), DLC cells (`m61_*`) and legacy dungeons (`m10_*` etc.). Treasure entries there link item lots to world positions, so item locations can probably be extracted (milestone 6).

**Gotchas worth remembering:**

- Event flags (grace discovered, item picked up, boss beaten) tie these sources together. They are the natural keys for each profile's progress and for prerequisites.
- **Patches can change formats:** `regulation.bin` switched from Kraken to ZSTD compression in a recent patch. Param field offsets come from Paramdex and are checked against row size, so a layout change fails loudly. After a game patch, rerun `npm run extract`.
- **Known gaps:** about 120 tiny archive files use an Oodle codec we don't decode, and 3 icons referenced by items don't exist. Neither affects the app.

## Data

Three kinds, kept separate:

1. **Game data (generated):** `game-data/catalog.json`, `icons/`, `map/`. Never edited by hand, never committed.
2. **Player-authored map data, one file per profile:** `maps/<profile id>.json` in the app data folder. Nodes (grace, junction, item, entrance) in native map pixels of their layer, and edges (typed polylines between nodes; only waygates join layers).
   - **Upgrade:** the single `map.json` of earlier versions becomes the first profile's map (`profile-1`) the first time it is read.
   - **Profile IDs** are lowercase letters, digits and dashes, since they name files.
   - **Deleting a profile** moves its map file into a `deleted/` folder instead of removing it, since it's player data.
3. **Player state:** `player.json` in the app data folder: app settings (language, map view) plus the playthrough profiles and which one is active.
   - **Profile (built):** ID, name, goal, constraints (free text for now).
   - **Joining each profile in milestone 4:** wishlist (item, status needed / acquired / skipped, note), progress (discovered graces, picked-up items, beaten bosses, as event flags), current position, and the linked save slot (Steam ID, slot index, character name).
   - **Schema version 2.** A version 1 file (no profiles) upgrades on read into one untitled profile.

`ROUTE_OF_GRACE_DATA_DIR` overrides the app data folder (used for tests). Saves are atomic, revision-checked across windows, and served to localhost only.

Graces imported from game data are stored as ordinary nodes with a `ref` to their grace ID. That way paths can attach to them, and the player can still nudge them.

The route itself is never stored: it is worked out from the active profile's map, wishlist, progress, position and constraints.

## Design

### Map

Leaflet with `CRS.Simple` over the extracted tiles; one layer per map (built). Legacy dungeons stay single entrance nodes with step-by-step notes. The overworld map doesn't help inside them, though `WorldMapLegacyConvParam` can place their graces on the overworld.

### Path graph

- **Nodes:** graces, junctions, item pins, dungeon entrances.
- **Edges:** polylines typed `road`, `torrent`, `foot`, `one-way-drop`, `lift`, `waygate`, `spiritspring`, `requires-key`, `requires-flag`. The type sets cost and rules.
- **Unexplored areas:** fall back to a straight line between points, shown as "path is a guess" until the player draws a real one.

### Routing

Everything here runs for the active profile.

- **Constraints:** the profile's constraints filter the graph and the targets: path types that aren't allowed (for example no Torrent), DLC in or out, items or bosses to avoid. They start as free text and become structured fields as routing needs them; the free-text note stays.
- **Travel cost:** shortest path over the graph. Edge cost = length × the type's speed factor, plus fixed costs (lift, waygate). Fast travel to any grace this profile has discovered is a cheap jump, except where it's blocked (inside legacy dungeons before their grace).
- **Visit order:** an ordering problem with prerequisites. Nearest neighbor plus 2-opt is enough for a few dozen targets.
- **Rerouting:** when an item is added to the profile's wishlist, fit it into the current route at the cheapest point and show the extra cost ("+4 min, best after the Liurnia grace") before committing.
- **Views:** "Next stops" (the active route), "Blocked by X" ("beating Radahn unlocks 4 of your wishlist items"), "Don't miss" (quest-sensitive items).

### OBS viewer

- **Base:** the old project's read-only viewer (WebSocket relay; operator publishes snapshots, viewers follow).
- **URL options:** a separate URL with layouts (full map with route, corner minimap, "next 3 stops" strip), a transparent background, large text, `?lang=zh-TW`, and `?profile=` to pin one playthrough (default: the active one).
- **Updates:** live over WebSocket from the operator app, with an optional hotkey for "advance to next stop".

### Agent tools

A local MCP server for Claude Code and Claude Desktop, mainly for managing the wishlist from a chat. Every tool works on the active profile's wishlist only; it never touches the map or other profiles. The app updates live.

| Tool              | Does                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `search_items`    | Finds catalog items by English or zh-TW name, so the right item ID is added.                                                                     |
| `add_to_wishlist` | Adds an item, optionally with a note. Suggests its region and requirements and asks the player to confirm (the pin itself is placed in the app). |
| `get_wishlist`    | Lists the wishlist with each item's acquisition state (needed / acquired / skipped) and note.                                                    |
| `set_item_note`   | Adds or replaces the note on a wishlist item.                                                                                                    |

Tool definitions stay separate from transport, so a WebMCP adapter can come later. Route, detour and map tools can follow if they turn out useful; they aren't planned.

## Build order

### 1. Extraction ✅

Done: catalog, icons, map tiles, natively on macOS.

### 2. Map editor ✅

Done: layers, node placement, typed path drawing, catalog linking with icons, undo/redo, English/zh-TW, local saving.

Follow-ups:

- [ ] End-to-end browser tests (Playwright; patterns in the old project's `tests/e2e`).
- [ ] Try waygate linking between layers by hand; it is unit-tested only.
- [ ] Keep the editor fast as the graph grows (hundreds of nodes redraw on every change today).

### 3. Graces from game data ✅

Done: graces in `catalog.json` (ID, names, layer, map position, discovered flag, legacy-dungeon marker); one-click import per layer that links hand-placed graces within 48 px and skips graces already linked or duplicated (Leyndell's ashen twins); nearby-grace suggestions for unlinked grace nodes. Calibration from player anchors turned out unnecessary because the transform is exact.

Follow-ups:

- [ ] `dlc-underground` has no graces: every DLC grace has display mask 0, so the surface/underground bit doesn't apply. Find out what the DLC underground map shows before importing anything there.

Original plan, kept for reference:

- [x] Extract `BonfireWarpParam` into `catalog.json`: grace ID, name, layer, world position, discovered flag.
- [x] ~~**Calibrate the world-to-map transform per layer.**~~ Not needed; see above. Fit scale and offset by least squares from 3+ graces the player places by hand, then check against all graces. Use the cell grid (`areaNo`, `gridX`, `gridZ`) plus local position. Handle legacy dungeons through `WorldMapLegacyConvParam`, and underground and DLC layers separately.
- [x] Import graces as nodes in one click, skipping any already placed.

### 4. Profiles, wishlist and routing

The interface for these features stays plain and functional; only blockers are fixed until the redesign in milestone 5.

- [x] **Playthrough profiles:** create, rename, switch (header) and delete; goal and constraints as free text. Version 1 player files upgrade into one untitled profile.
- [x] **Map per profile:** move `map.json` to `maps/<profile id>.json` (the existing map goes to `profile-1`); switching profiles loads that profile's map; undo history is per profile; a new profile starts empty; a deleted profile's map moves to `deleted/`.
- [x] **"Import from another profile":** pick a profile and, optionally, one layer; copy its nodes and paths into the active profile as one undo step. Graces already present (same grace ID) are reused instead of duplicated, so copied paths attach to them.
- [x] Wishlist per profile, with status (needed / acquired / skipped) and a note.
- [x] Bring in `seed/wishlist.json` as a profile's wishlist (copy it out of the handoff folder; official names replace the seed's). It was the "Great Stars Guard Counter" build, so it can start a profile with that name.
- [x] Progress per profile: discovered graces, picked-up items, beaten bosses, current position. (Stored as event flags; only graces have flags in the game data so far, so items and bosses wait for the save import's flag data.)
- [x] **"Import progress from save" button.** Graces only, until item and boss flags are extracted. Uses the community's event-flag block table (`eventflag_bst.txt`), which `npm run extract` downloads at a pinned commit.
  - Read the character's event flags from the game save (read-only) and mark discovered graces, picked-up items and beaten bosses in the active profile.
  - The first import asks for the character slot and links it to the profile (Steam ID, slot index, character name); later imports reuse the link. If the slot now holds a character with a different name, ask instead of importing.
  - Show what changed before applying it.
  - The save is `drive_c/users/crossover/AppData/Roaming/EldenRing/<Steam ID>/ER0000.sl2` in the bottle: an unencrypted BND4 with 10 character slots, each behind an MD5 checksum.
- [ ] Structured constraints as routing needs them (allowed path types, DLC in or out).
- [ ] Edge costs per type; Dijkstra with fast travel to the profile's discovered graces; straight-line guesses for gaps.
- [ ] Visit order (nearest neighbor + 2-opt) and the detour estimate.
- [ ] "Next stops" view, with the route drawn on the map.

### 5. UI redesign

After milestone 4, when every main screen exists (map editor, profiles, wishlist, progress, save import, route), so the design covers how profiles shape the whole app rather than being patched one feature at a time.

- [ ] Collect UI issues from the player during milestone 4 here, as they come up.
- [ ] Layout: header, side panel, where the profile, wishlist, progress and route live; desktop and narrow windows.
- [ ] Map: node markers, labels and path styles, readable at stream resolution too, since the OBS viewer (milestone 8) reuses them.
- [ ] English and zh-TW checked together (text length, wording against the game's own terms).
- [ ] Later milestones (6–9) build their UI to this design.

### 6. Item locations from map layout files (spike, then build)

- [ ] Parse ER MSB treasure entries: part position + item lot ID, per map cell.
- [ ] Join item lot → item → world position → map pixel (milestone 3's transform).
- [ ] If reliable, offer "place pin from game data" when wishlisting; otherwise keep manual pins. Shops, drops from enemies and quest rewards have no treasure position, so manual pins and notes stay necessary.

### 7. Local MCP server

- [ ] The four tools above, on the active profile's wishlist, writing `player.json` through the same store and revision checks as the app.
- [ ] When adding a wishlist item, suggest region and requirements, and ask the player to confirm the pin.

### 8. OBS viewer

- [ ] Copy in `server/viewer.ts` and `src/sync/*` from the old project. Replace `LiveSnapshot.ui` with map view state (center, zoom, layer, selected stop) and drop `scroll.ts`.
- [ ] Layouts, transparent background, `?lang=`, hotkey to advance.

### 9. Prerequisites and missables

- [ ] Requirement flags on edges and items, using game event flags where possible (boss beaten, grace discovered). Requirements live on the profile's map; whether they're met comes from that profile's progress.
- [ ] "Blocked by X" and "Don't miss" views, per profile.

## Risks and open questions

- **MSB parsing (milestone 6):** not yet attempted. The ER format is documented by the modding community (SoulsFormats). Coverage is limited to world pickups.
- **Reading progress from the save:** decided: a manual import button (milestone 4).
  - **Safety:** the app never writes the save; it copies the file, checks each slot's MD5, and parses the copy.
  - **Hardest part (solved):** finding the event-flag block inside a slot, which sits after variable-length sections (`server/save.ts`, following er-save-manager's documentation). A flag's byte comes from a block table that was reverse-engineered by the community and can't be read from the game files.
  - **Live updates:** possible later by watching the file and re-importing when the game saves. A read caught mid-write fails the MD5 check and is retried. Not planned yet.
- **Keeping profile maps in sync:** each profile has its own map, so a path fixed in one profile isn't fixed in the others. "Import from another profile" covers starting a playthrough; if re-syncing later becomes a chore, add a merge that brings over only what's new.
- **Hand-drawn paths stay ongoing work:** keep the editor fast (click to add waypoints, choose the type, undo).
- **Game patches:** rerun the extractor; formats have already changed once.
