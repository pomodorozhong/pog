# Route of Grace: plan

Updated 2026-10-12. Replaces the build order in the old project's handoff note, and adds what extracting the game data taught us.

## Goal

A map-based route planner for Elden Ring (base game and Shadow of the Erdtree). The player keeps a wishlist and their progress; the app works out the actual path on the map and updates it whenever the wishlist changes.

**Main pain point:** planning a route to collect items, then changing it as new items worth getting are found. The old app failed because every item needed hand-curated data; anything this app needs should come from the game files or from a few clicks by the player.

## Decisions

| Topic | Decision |
| --- | --- |
| Route meaning | A real path drawn on the map, not an ordered list of places. |
| Path data | The player draws paths in the editor. No automatic navmesh. |
| Places | Graces come from the game data. Item pins come from the game data once item locations are extracted (milestone 5); until then the player places them. |
| Names | Official in-game English and zh-TW names win over any other source. Player-written text is kept as written. |
| Language | English and Traditional Chinese (zh-TW) for all interface text. |
| Spoilers | Fine. Show missable and quest-lock warnings freely. |
| Viewer mode | Required: a read-only URL used as an OBS browser source. |
| DLC | In scope (separate map layers). |
| Platform | Mac, game running in CrossOver. Everything runs natively on macOS. |
| Live position | No. The player sets their position by hand (for example "at grace X"). |
| Game assets | Generated locally by the extractor, never committed. Only the script is in git. |

## What the extraction taught us

Everything below comes from the player's own install, read natively on macOS in about 100 seconds (see `scripts/extract/README.md`).

**Already extracted (`game-data/`):**
- **Catalog:** 3,714 items (weapons, armor, talismans, goods, Ashes of War), 674 of them DLC, plus 1,007 places and 483 NPCs. Every entry has official English and zh-TW names.
  - All 46 seed wishlist items are found. 5 of the seed's zh-TW names were community translations and are replaced by the official ones.
  - Place names repeat under several IDs (region name vs. area name), so search shows each name once.
  - Goods carry a `goodsType`, which can separate spells, spirit ashes, key items and consumables later.
- **Icons:** 2,650 item icons (256 px WebP).
- **Map tiles:** fully revealed Leaflet tile pyramids for 4 layers: `overworld` (M00), `underground` (M01), `dlc` (M10), `dlc-underground` (M11). The full-resolution layers are 10,496 px square (8,704 px for `dlc-underground`), zoom 0–6.

**Available in the game data but not yet used:**
- **`BonfireWarpParam`:** all 422 graces, each with its official name, its "discovered" event flag, and its world position. Graces at boss arenas are named after the boss.
- **World-to-map transform:** for the overworld (map area 60), map pixel ≈ world meter (scale 1.0). The offset is roughly (7040, 16640), with y flipped. With that offset, 161 of 166 overworld graces land on land, but some are off by 100–200 px. The exact transform still needs calibrating (milestone 3).
- **`WorldMapLegacyConvParam`:** converts positions inside legacy dungeons (Stormveil, Leyndell…) onto the overworld map.
- **`WorldMapPointParam`:** the game's own map markers, with positions and names.
- **`ItemLotParam`:** what each pickup gives and its "picked up" event flag, but no position.
- **Map layout files (`map/mapstudio/*.msb`):** readable for overworld cells (`m60_*`), DLC cells (`m61_*`) and legacy dungeons (`m10_*` etc.). Treasure entries there link item lots to world positions, so item locations can probably be extracted (milestone 5).

**Gotchas worth remembering:**
- Event flags (grace discovered, item picked up, boss beaten) tie these sources together. They are the natural keys for progress and prerequisites.
- **Patches can change formats:** `regulation.bin` switched from Kraken to ZSTD compression in a recent patch. Param field offsets come from Paramdex and are checked against row size, so a layout change fails loudly. After a game patch, rerun `npm run extract`.
- **Known gaps:** about 120 tiny archive files use an Oodle codec we don't decode, and 3 icons referenced by items don't exist. Neither affects the app.

## Data

Three kinds, kept separate:

1. **Game data (generated):** `game-data/catalog.json`, `icons/`, `map/`. Never edited by hand, never committed.
2. **Player-authored map data:** `map.json` in the app data folder. Nodes (grace, junction, item, entrance) in native map pixels of their layer, and edges (typed polylines between nodes; only waygates join layers).
3. **Player state:** `player.json` in the app data folder. Today it holds language and map view; wishlist, progress and current position join it in milestone 4.

`ROUTE_OF_GRACE_DATA_DIR` overrides the app data folder (used for tests). Saves are atomic, revision-checked across windows, and served to localhost only.

Graces imported from game data are stored as ordinary nodes with a `ref` to their grace ID. That way paths can attach to them, and the player can still nudge them.

## Design

### Map
Leaflet with `CRS.Simple` over the extracted tiles; one layer per map (built). Legacy dungeons stay single entrance nodes with step-by-step notes. The overworld map doesn't help inside them, though `WorldMapLegacyConvParam` can place their graces on the overworld.

### Path graph
- **Nodes:** graces, junctions, item pins, dungeon entrances.
- **Edges:** polylines typed `road`, `torrent`, `foot`, `one-way-drop`, `lift`, `waygate`, `spiritspring`, `requires-key`, `requires-flag`. The type sets cost and rules.
- **Unexplored areas:** fall back to a straight line between points, shown as "path is a guess" until the player draws a real one.

### Routing
- **Travel cost:** shortest path over the graph. Edge cost = length × the type's speed factor, plus fixed costs (lift, waygate). Fast travel to any discovered grace is a cheap jump, except where it's blocked (inside legacy dungeons before their grace).
- **Visit order:** an ordering problem with prerequisites. Nearest neighbor plus 2-opt is enough for a few dozen targets.
- **Rerouting:** when an item is wishlisted, fit it into the current route at the cheapest point and show the extra cost ("+4 min, best after the Liurnia grace") before committing.
- **Views:** "Next stops" (the active route), "Blocked by X" ("beating Radahn unlocks 4 of your wishlist items"), "Don't miss" (quest-sensitive items).

### OBS viewer
- **Base:** the old project's read-only viewer (WebSocket relay; operator publishes snapshots, viewers follow).
- **URL options:** a separate URL with layouts (full map with route, corner minimap, "next 3 stops" strip), a transparent background, large text, and `?lang=zh-TW`.
- **Updates:** live over WebSocket from the operator app, with an optional hotkey for "advance to next stop".

### Agent tools
A local MCP server for Claude Code and Claude Desktop, changing the same documents the app reads. The app and the overlay update live. Starting tools: `search_items` (English or zh-TW), `add_to_wishlist`, `place_pin`, `get_route`, `estimate_detour`, `mark_done`. Tool definitions stay separate from transport, so a WebMCP adapter can come later.

## Build order

### 1. Extraction ✅
Done: catalog, icons, map tiles, natively on macOS.

### 2. Map editor ✅
Done: layers, node placement, typed path drawing, catalog linking with icons, undo/redo, English/zh-TW, local saving.

Follow-ups:
- [ ] End-to-end browser tests (Playwright; patterns in the old project's `tests/e2e`).
- [ ] Try waygate linking between layers by hand; it is unit-tested only.
- [ ] Keep the editor fast as the graph grows (hundreds of nodes redraw on every change today).

### 3. Graces from game data (new)
- [ ] Extract `BonfireWarpParam` into `catalog.json`: grace ID, name, layer, world position, discovered flag.
- [ ] **Calibrate the world-to-map transform per layer.** Fit scale and offset by least squares from 3+ graces the player places by hand, then check against all graces. Use the cell grid (`areaNo`, `gridX`, `gridZ`) plus local position. Handle legacy dungeons through `WorldMapLegacyConvParam`, and underground and DLC layers separately.
- [ ] Import graces as nodes in one click, skipping any already placed. Show uncalibrated layers as "positions approximate".

### 4. Wishlist and routing
- [ ] Bring in `seed/wishlist.json` (copy it out of the handoff folder; official names replace the seed's).
- [ ] Player state: wishlist with status (needed / acquired / skipped), discovered graces, beaten bosses, current position.
- [ ] **"Import progress from save" button.**
  - Read the character's event flags from the game save (read-only) and mark discovered graces, picked-up items and beaten bosses.
  - Show what changed before applying it, and let the player pick the character slot.
  - The save is `drive_c/users/crossover/AppData/Roaming/EldenRing/<Steam ID>/ER0000.sl2` in the bottle: an unencrypted BND4 with 10 character slots, each behind an MD5 checksum.
- [ ] Edge costs per type; Dijkstra with fast travel; straight-line guesses for gaps.
- [ ] Visit order (nearest neighbor + 2-opt) and the detour estimate.
- [ ] "Next stops" view, with the route drawn on the map.

### 5. Item locations from map layout files (spike, then build)
- [ ] Parse ER MSB treasure entries: part position + item lot ID, per map cell.
- [ ] Join item lot → item → world position → map pixel (milestone 3's transform).
- [ ] If reliable, offer "place pin from game data" when wishlisting; otherwise keep manual pins. Shops, drops from enemies and quest rewards have no treasure position, so manual pins and notes stay necessary.

### 6. Local MCP server
- [ ] The starting tool set above, sharing `map.json` and `player.json` with the app (through the same store and revision checks).
- [ ] When adding a wishlist item, suggest region and requirements, and ask the player to confirm the pin.

### 7. OBS viewer
- [ ] Copy in `server/viewer.ts` and `src/sync/*` from the old project. Replace `LiveSnapshot.ui` with map view state (center, zoom, layer, selected stop) and drop `scroll.ts`.
- [ ] Layouts, transparent background, `?lang=`, hotkey to advance.

### 8. Prerequisites and missables
- [ ] Requirement flags on edges and items, using game event flags where possible (boss beaten, grace discovered).
- [ ] "Blocked by X" and "Don't miss" views.

## Risks and open questions

- **Transform accuracy (milestone 3):** the scale-1 fit is close but not exact. If calibration from a few anchors isn't good enough everywhere, the game's own map menu data may hold the exact constants.
- **MSB parsing (milestone 5):** not yet attempted. The ER format is documented by the modding community (SoulsFormats). Coverage is limited to world pickups.
- **Reading progress from the save:** decided: a manual import button (milestone 4).
  - **Safety:** the app never writes the save; it copies the file, checks each slot's MD5, and parses the copy.
  - **Hardest part:** finding the event-flag block inside a slot, which sits after variable-length sections. Community save editors document the layout.
  - **Live updates:** possible later by watching the file and re-importing when the game saves. A read caught mid-write fails the MD5 check and is retried. Not planned yet.
- **Hand-drawn paths stay ongoing work:** keep the editor fast (click to add waypoints, choose the type, undo).
- **Game patches:** rerun the extractor; formats have already changed once.
