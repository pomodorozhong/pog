# Path of Grace: architecture

How the app works and why. What is being built, and in which order, lives in [GitHub milestones](https://github.com/pomodorozhong/pog/milestones), its issues and `HANDOFF.md`. Interface details (sizes, timings, wording) live in the code and its tests; this page keeps the model and the rules that span files.

## Goal

A map-based route planner for Elden Ring (base game and Shadow of the Erdtree). The player plans and tracks several playthroughs. Each playthrough (a **profile** in the code and data) has its own goal, constraints, wishlist, progress and map; the app works out the route on that map and updates it whenever the wishlist or progress changes.

**Main pain point:** planning a route to collect items, then changing it as new items worth getting are found. The old app failed because every item needed hand-curated data; anything this app needs should come from the game files or from a few clicks by the player.

## Decisions

| Topic           | Decision                                                                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Route meaning   | A real path drawn on the map, not an ordered list of places.                                                                                              |
| Playthroughs    | One profile is one whole route: its own goal, constraints, wishlist, progress, position, linked save slot and map. Switching profiles switches all of it. |
| Map per profile | Each profile has its own nodes and paths. "Import from another playthrough" copies them across, so a new playthrough doesn't start from a blank map.      |
| Path data       | The player draws paths in the editor. No automatic navmesh.                                                                                               |
| Places          | Graces and bosses come from the game data. Item pins will too (the Item locations milestone); until then the player places them.                          |
| Names           | Official in-game English and zh-TW names win over any other source. Player-written text is kept as written.                                               |
| Language        | English and Traditional Chinese (zh-TW) for all interface text.                                                                                           |
| Spoilers        | Fine. Show missable and quest-lock warnings freely.                                                                                                       |
| Mirror mode     | Required: a read-only URL used as an OBS browser source, copying the player's own app window.                                                             |
| DLC             | In scope (separate map layers).                                                                                                                           |
| Platform        | Mac, game running through Steam or CrossOver. Everything runs natively on macOS.                                                                          |
| Position        | Follows the last grace rested at in the save (#69), and the player can set it by hand. Whether the save holds a live position is an open spike (#66).     |
| Progress import | From the save, by hand or automatically whenever the game saves (#18). The app never writes the save.                                                     |
| Game assets     | Generated locally by the extractor, never committed. Only the script is in git.                                                                           |

## What the extraction taught us

Everything below comes from the player's own install, read natively on macOS in about 100 seconds (see `scripts/extract/README.md`).

**Extracted (`game-data/`):**

- **Catalog:** 3,714 items (weapons, armor, talismans, goods, Ashes of War), 674 of them DLC, plus 419 graces, 211 bosses, 1,007 places and 483 NPCs. Every entry has official English and zh-TW names.
  - Place names repeat under several IDs (region name vs. area name), so search shows each name once.
  - Goods carry a `goodsType`, which can separate spells, spirit ashes, key items and consumables later.
- **Icons:** 2,650 item icons (256 px WebP).
- **Map tiles:** fully revealed Leaflet tile pyramids for 4 layers: `overworld` (M00), `underground` (M01), `dlc` (M10), `dlc-underground` (M11). The full-resolution layers are 10,496 px square (8,704 px for `dlc-underground`), zoom 0–6.
- **Graces:** 419 of the 422 `BonfireWarpParam` rows, with official names, "discovered" event flags, map pixel positions and `entity` (the `bonfireEntityId` the save's last grace refers to). 3 rows are unnamed or unreachable. Graces at boss arenas are named after the boss.
- **Bosses:** 211 of the 212 `GameAreaParam` rows with a "beaten" flag, each with its official name, flag and map position (`bossMap*No` and `bossPos*`, projected like graces); 39 are in the DLC. The param has no name (`foundBossTextId` is the generic "boss found" message), so the name comes from the boss health bar the map's event script (`event/<map>.emevd`) shows: its `NpcName` text and the entity it's on. The row's own ID, then its flag, is usually that entity. Field bosses run a shared event from `common_func.emevd`, so its arguments are filled in first, and a bar whose event uses the flag also counts. Duos and second phases give several names (Godfrey and Hoarah Loux); the first is the main one. The one row left is a second Scadutree Avatar row with no bar of its own.
- **Pickups:** 3,489 spots for 3,458 item lots from the map layout files, placing 999 catalog items, each with its pickup flag (`getItemFlagId`). See "Item locations" below.
- **Event-flag block table:** `eventflag_bst.txt`, downloaded by `npm run extract` from ER-Save-Lib at a pinned commit and checked by SHA-256 (unlicensed, so not committed). It can't be derived from the game files.

**World-to-map transform (exact, no calibration needed):** one transform fits every layer: map pixel = (world x − 7040, 16512 − world z), one pixel per meter. World x/z come from area 60 or 61 grid cells (`grid × 256 + position`). Graces inside legacy dungeons, caves and catacombs are moved into area 60/61 by following `WorldMapLegacyConvParam` rows, which work in both directions and sometimes chain (Deeproot → Leyndell sewers → Leyndell → overworld).

**Item locations (spike #8; `pickups` in the catalog since #9):** the map layout files place most pickups, so item pins can come from the game data. `build_pickups` in the extractor writes them, and `scripts/extract/item_locations_report.py` prints the counts below.

- **How:** each MSB (`map/mapstudio/*.msb`: legacy maps, and open-world tiles of 256 m, 512 m and 1 km) has treasure events (type 4) naming an item lot (`ItemLotParam_map`) and the part holding it: an asset, chest or corpse, whose position is the item's. Picking up a lot also gives the lot rows right after it, up to a gap. Positions project onto the map like graces, except that 512 m and 1 km tiles measure from their center (`index × size + size / 2`); 256 m tiles and legacy maps measure from their corner. The reader follows SoulsFormats' MSBE.
- **Coverage:** 3,639 treasure events in 1,196 readable layouts give 3,466 of the 5,410 map item lots a position (chains included). That places 999 of the 1,838 catalog items found in any map lot: talismans 99/146, goods 561/963, weapons 194/314, armor 133/331, Ashes of War 12/84. A lot often has several spots (Golden Seeds, Stonesword Keys).
- **Accuracy:** every spot lies on the map, a median 74 px from the nearest grace on its layer, and spot checks match (Flask of Wondrous Physick, Sacred Tears, the Dectus Medallion halves). Spots inside legacy dungeons and caves sit where their map is projected onto the open world, which can be 100–200 px off the entrance.
- **Not placed by the MSBs:** lots the event scripts award (boss drops, NPC gifts and quest rewards, such as Moonveil or the Talisman Pouch), enemy drops (`ItemLotParam_enemy`, including Teardrop Scarabs, so most Ashes of War) and shop wares (`ShopLineupParam`). Boss drops can sit at the boss's position in the catalog, and NPC gifts and enemy drops at the MSB enemy part, all from game data.
- **Gaps:** 52 tiny open-world layouts (at the map's edges) use an Oodle codec ooz lacks; 60 treasure events point at no part.
- **Flags:** every placed lot has a pickup flag. Of the 92 spots holding a chain of lots, 50 share one flag across the chain; the rest give each row its own.
- **Duplicates:** Leyndell's Royal and Ashen Capital layouts place the same lots at the same spots, so a spot within 2 px of one the lot already has is dropped.

**Community sources (no coordinates worth taking):** Fextralife and Map Genie have hand-placed markers with no licence to reuse; [CreateDDy/EldenRing_MapInteractive](https://github.com/CreateDDy/EldenRing_MapInteractive) (MIT) has coordinates for key items only, on its own map image; [ERDB](https://github.com/EldenRingDatabase/erdb) (MIT) has text locations and requirements but no coordinates; the [item randomizer](https://github.com/thefifthmatt/SoulsRandomizers)'s `itemslots.txt` has a written location per lot but is all rights reserved. So item positions come from the game data: MSB treasures first (#9), then boss drops and enemy parts. They carry the official item IDs and pickup flags (`getItemFlagId`, #11), follow game patches, and need no permission. ERDB's text could later add descriptions and requirements.

**Available but not yet used:** `WorldMapPointParam`, the game's own map markers, with positions and names.

**Gotchas:**

- Event flags (grace discovered, item picked up, boss beaten) tie these sources together. They are the keys for each profile's progress and for prerequisites.
- **Patches can change formats:** `regulation.bin` switched from Kraken to ZSTD compression in a recent patch. Param field offsets come from Paramdex and are checked against row size, so a layout change fails loudly. After a game patch, rerun `npm run extract`.
- **Some bosses share a flag:** the Night's Cavalry at `1039510800` and the Deathbird at `1044530800` have the Bell Bearing Hunter's flag `1043530800`, so the save can't tell them apart.
- **Leyndell graces come in twins:** the Royal and Ashen Capital versions share a name and spot but have separate flags. Only the first of each pair shows on the map (#27).
- **No boss portraits:** the menu archive the extractor reads (`menu/hi/00_solo`) holds item icons, loading screens and tutorial images, and nothing per boss. Remembrance icons are the nearest boss pictures.
- **`dlc-underground` has no graces:** every DLC grace has display mask 0, so the surface/underground bit doesn't apply there (#5).
- **Known gaps:** about 120 tiny archive files use an Oodle codec we don't decode, and 3 icons referenced by items don't exist. Neither affects the app.
- JavaScript's `&` is signed; use `>>> 0` for handle masks. Filenames that differ only in case clash on macOS.

## Data

Three kinds, kept separate:

1. **Game data (generated):** `game-data/catalog.json`, `icons/`, `map/`. Never edited by hand, never committed.
2. **Player-authored map data, one file per profile:** `maps/<profile id>.json` in the app data folder.
   - **Nodes:** the player's pins, in native map pixels of their layer. A pin is a junction or a dungeon entrance (linked to its place), and can hold `items` (catalog items picked up there) and `bosses` (fought there).
   - **Paths** (`edges`): each one line through an ordered list of nodes, with its look, options and `step` in the player's walk. A hop between two layers is a waygate jump. A path can run through a game grace by its grace ID (`grace/<row>`).
   - **Note paths:** a path through one node with `step: null` holds that node's note, so graces can have notes without being stored.
   - **Grace additions:** what the player adds to a game grace (a label, the `place` it is the entrance to, `items`, `bosses`) is kept in an optional `graces` object by grace ID, only while something is set.
   - **Upgrades:** older map files upgrade on read (now version 4). Version 2 turned bends into junctions and numbered paths in file order, dropping bends between two game graces; versions 3 and 4 removed path types. The single `map.json` of early versions becomes the first profile's map.
   - Profile IDs are lowercase letters, digits and dashes, since they name files. Deleting a profile moves its map into a `deleted/` folder, since it's player data.
3. **Player state:** `player.json` in the app data folder (schema version 12; older files upgrade on read): app settings (language, map view, step number size, grace filter, grace names, save location, automatic import), the profiles and which one is active.
   - **Each profile:** ID, name, goal, constraints (structured fields plus a free-text note), wishlist (item, the pin holding it if any, status needed / acquired / skipped, note), progress (discovered graces, picked-up items, beaten bosses, as event flags), current position, the last grace rested at in the save, and the linked save slot (Steam ID, slot index, character name).

`POG_DATA_DIR` overrides the app data folder (used for tests). Saves are atomic, revision-checked across windows, and served to localhost only.

**Game graces are not stored.** Like the map tiles, they're game data: every profile's map shows them from `catalog.json`, with the grace ID as node ID, so paths, positions and fast travel refer to them directly and a game patch reaches every profile. They can't be moved or deleted, and keep their official name. What the player adds is merged onto them when the map is shown.

**The route is never stored:** it is worked out from the active profile's map, wishlist, progress, position and constraints.

## Design

### Layout

One layout at every width (#28, #46): a header with the playthrough switcher (the goal), Undo and Redo, and a ☰ menu; the map with its tools; and a side panel (a column on wide screens, a bottom sheet on narrow ones). The side panel shows the playthrough tracker, or the details of whatever is selected on the map, or the playthrough's cards (goal, progress and save import, next stops, wishlist, this map).

### Map

Leaflet with `CRS.Simple` over the extracted tiles, one layer per map. The editor places pins, draws paths, attaches catalog items and bosses to pins and graces, and has undo/redo per profile. Legacy dungeons stay single entrance nodes with notes; `WorldMapLegacyConvParam` places their graces on the overworld.

- **Graces:** every game grace shows on its layer, and there's no tool to place one by hand. A grace's details offer what a pin's do (a label beside its official name, entrance, items, bosses, a note). Its `ref` stays its grace ID, which names, discovery flags and fast travel use.
- **Grace filter:** an app setting that hides graces no path runs through. A grace stays visible when it's the player's position, selected, or has something the player added. It only changes the display: routing and fast travel use every discovered grace.
- **Display settings** (step number size, grace names) are app settings shared across playthroughs.

### Paths and steps

- **Paths** are all one kind: a look (color, solid or dashed), a note, and **one way** (travelled only in drawing order, such as a drop), the one option that changes routing. A hop between layers is a waygate jump: not drawn, its pins marked instead. Waygates within one layer are ordinary paths until they come from game data (#48).
- **Drawing:** a path is the whole line drawn in one go; each click drops a junction or passes through a node. Afterwards it can be extended from its last node or split at an inner node. Changing a drawn path's nodes is #41.
- **Steps:** walked paths are numbered 1..N in the order the player will walk them, like a guide's steps, with no gaps or repeats: a new path goes last, removing one closes the gap, imported paths follow the last step, and "Move…" puts a path anywhere. Note paths have no step. Step numbers stay readable on the map: they slide clear of icons (#37) and spread out when held on the screen edge (#33).
- **Current path (#44):** among the walked paths through "I'm here", the lowest step with something left to do on it (a grace not discovered, a boss not beaten, or a wishlist entry still needed); with nothing left on any, the lowest step the player is partway along or starting. Its arrows move on the map. Focus mode (#68) and zooming to it (#70) should use the same rule (`currentPath` in `src/map/pathArrows.ts`).

### Wishlist and tracker

- **Entries per pin (#57):** a wishlist entry is an item at one pin or grace, with its own status and note, so two Golden Seeds in two places are two entries. An entry with no pin (added from search, or whose pin or item is gone) shows under "Not attached to a pin" and can be attached from a pin's item editor; it keeps its stored pin, so undo brings it back.
- **Items on a walked path (#55):** an item on a pin a walked path goes through is on the wishlist as needed without being added. These joined entries aren't saved: readers work out the wishlist as the saved entries followed by the joined ones. One becomes saved once the player marks it or writes a note; until then it leaves when no walked path reaches its pin. So editing or undoing paths never rewrites the saved wishlist.
- **Bosses (#52, #60):** any pin or grace can list the bosses fought there. Every boss a walked path reaches joins the tracker, before the pin's items. A boss is beaten or not (no skipped state), and tapping it sets or clears the same flag the save import reads.
- **Tracker order:** by the step that first reaches the pin, then along that path, then by place on the pin, so marking an entry never moves it. Note paths don't count as walked.

### Profiles

Create, switch, rename and delete from the header's switcher. A new profile starts with no nodes of its own; the game graces are already there. **"Import from another playthrough"** copies another profile's nodes and paths (optionally one layer) as one undo step; nodes already present (same ID, game graces included) are reused, so copied paths attach to them. A template (`seed/great-stars-guard-counter.json`) can start a profile with its wishlist, with official names replacing the seed's.

### Progress from the save

The import reads the character's event flags and marks discovered graces, beaten bosses and picked-up wishlist items in the active profile. It asks only about bosses at the map's pins and graces, and about the pickups of wishlist entries, so other flags stay as they are.

- **Items (#11):** a wishlist entry is tracked by the game's pickup spot for its item (`pickups` in the catalog): the item's only spot, or, for an item with several (Golden Seeds, Smithing Stones), the spot nearest the entry's pin on its layer within 250 px (dungeon spots can sit 100–200 px off the entrance). Entries joined from a walked path count too. A needed entry whose pickup flag is set becomes acquired, and a joined one is saved then; the save never makes an entry needed again, and skipped stays skipped. Items with no spot near their pin, and shop wares, boss and enemy drops, are marked by hand.

- **Where:** `drive_c/users/<user>/AppData/Roaming/EldenRing/<Steam ID>/ER0000.sl2` in a Windows prefix: an unencrypted BND4 with 10 character slots, each behind an MD5 checksum. The server looks in every CrossOver bottle and in Steam's own prefix (`~/Library/Application Support/Steam/steamapps/compatdata/1245620/pfx`), and lists each save it finds with its path (#43).
- **Choosing the save:** picking a character remembers its save file (`saveLocation`, shared by every playthrough). "Choose another location" takes a typed or pasted path, since a browser file picker can't give the server a path to read again. `POG_SAVE_DIR` wins over both.
- **Slot linking:** the first import links a character slot to the profile. If the slot later holds a character with another name, the import asks instead of importing.
- **Manual import** shows the changes for review before applying them. **Automatic import (#18)** applies them at once with a short note. The app polls the save's modification time and size every 3 seconds and reads it only when that changes; a checksum mismatch (the game was writing) is retried at the next check, and any other failure waits for the next change. Either way the save decides every grace and boss it reads: one marked by hand that the save lacks is cleared. Some pickups are only keys to a target item, which the tracker shouldn't list.
- **Position (#69):** the slot stores the grace last rested at as its `bonfireEntityId` + 1000 (checked on three characters). The import keeps it as `lastGrace` and moves "I'm here" only when it changes, so a position set by hand stays until the character rests somewhere new. An Ashen Capital grace maps to its Royal Capital twin on the map. A catalog extracted before graces carried `entity` reads no last grace.
- **Safety:** the app never writes the save; it copies the file, checks each slot's MD5, and parses the copy.
- **Finding the flags:** the event-flag block sits after variable-length sections in each slot (`server/save.ts`, following er-save-manager's documentation). A flag's byte comes from the block table (see extraction above).

### Routing

Everything here runs for the active profile (`src/routing/`).

- **Constraints:** DLC in or out, which leaves the DLC layers off the graph, plus a free-text note. The player avoids a path by not drawing it. Avoiding items or bosses is #21.
- **Travel cost:** distance, since paths say nothing about speed. Shortest paths (Dijkstra): a drawn hop costs its length (one map pixel is one metre); a hop between layers and fast travel to any discovered grace cost a short fixed distance. Unconnected pieces are bridged by straight guesses, which cost more than drawn paths and show as "path is a guess". The app shows no time estimates.
- **Visit order:** nearest neighbour plus 2-opt over the wishlist targets, enough for a few dozen.
- **Next stops:** the planned route as a list in the side panel. It isn't drawn on the map, since the player draws their own paths.
- **Planned, not built:** fast travel blocked where the game blocks it (inside legacy dungeons before their grace); fitting a new wishlist item into the route at the cheapest point and saying where ("best after the Liurnia grace"); and the "Blocked by X" view ("beating Radahn unlocks 4 of your wishlist items", #17), which needs requirement flags (#15).

### OBS mirror

A read-only copy of the player's own app window, for streaming: the player works in a normal browser window, and `/?mode=mirror` is the OBS browser source that stream viewers see, so nothing has to be operated inside OBS. It is not an audience feature. There is one mirror, on the same computer; the menu's "Mirror link" gives its address.

- **Relay** (`server/mirror.ts`, attached to the dev and preview servers): a WebSocket at `/api/mirror`, local requests only. The app's window publishes snapshots; the relay validates them, keeps the latest in memory and sends it to mirrors, and closes any mirror that sends anything. Each server port has its own live session.
- **Snapshot** (`src/sync/types.ts`): the player document, the active map with edits not saved yet, save status, and the screen state by key. Screen state is component state written with `useSharedState` instead of `useState` (what is selected, open menus and modals, filters, import steps), the map view on every frame of a move, and scroll positions. Snapshots are batched over 50 ms.
- **Mirror:** lays out at its own size, so OBS's source size picks the narrow or wide layout. The map keeps to the app's center and zoom; a scrolling panel (`data-scroll-sync`) keeps to the same entry and how far through it, not to pixels. It reads the saved documents until the first snapshot, keeps the last screen when the app's window closes, and catches up after a reload or reconnect. It never saves, never reads the game's save, ignores keys, and its page is `inert`, so it looks like the app's screen rather than disabled. No status shows on it; `<html data-live data-app>` holds the connection state for tests.

### Agent tools (#12)

A local MCP server for Claude Code and Claude Desktop, mainly for managing the wishlist from a chat (setup: [agent-tools.md](agent-tools.md)). Every tool works on the active profile only.

| Tool                  | Does                                                                                                                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_items`        | Finds catalog items by English or zh-TW name, so the right item ID is added.                                                                                                                                                                                                                                |
| `get_wishlist`        | Lists the wishlist with each item's pin, state (needed / acquired / skipped) and note, and the proposals waiting.                                                                                                                                                                                           |
| `add_to_wishlist`     | Proposes an item, optionally with a note. Item only: an entry with no pin, attached in the app. Item and pin: agents rarely have usable coordinates, so the agent names the nearest grace and applying it adds a junction pin holding the item 40 px east of it. Suggesting region and requirements is #13. |
| `set_item_note`       | Proposes adding or replacing the note on a wishlist entry.                                                                                                                                                                                                                                                  |
| `get_proposal_status` | Whether proposals were applied, dismissed, or are still waiting.                                                                                                                                                                                                                                            |

- **The tools run in the app's window** (`src/agent/`), on what it shows, like bookmark-router's WebMCP tools. The window is the only writer, so a change shows at once, saves through the usual revision checks, and undoes like any edit. The cost: the app must be open.
- **Getting there:** `server/mcp.ts` is a stdio MCP server that lists the tools (`src/agent/tools.ts`, plain data) and passes each call to the dev or preview server's relay (`server/agent.ts`, a WebSocket at `/api/agent`, local requests only). The relay hands it to the newest app window and the answer back, or says the app isn't open. Mirrors never connect.
- **Review first:** the write tools only queue a proposal; the player applies or dismisses it under "Agent changes" in the header. A proposal that went out of date says why and can only be dismissed. The queue is screen state in the app's window (`useSharedState`), so the mirror shows it and a reload drops it.
- **Later:** a WebMCP adapter (#20) can register the same tools in the page.

## Risks

- **Item coverage:** game data places about half the catalog's map items; boss drops, enemy drops, quest rewards and shops need other sources or manual pins.
- **Keeping profile maps in sync:** a path fixed in one profile isn't fixed in the others. "Import from another playthrough" covers starting one; bringing over only what's new is #19.
- **Hand-drawn paths are ongoing work:** the editor has to stay fast to draw and fix paths (#41).
- **Game patches:** rerun the extractor; formats have already changed once.
