# Game data extractor

Reads the item catalog, graces, bosses, icons and map tiles straight out of an installed copy of Elden Ring (base game and Shadow of the Erdtree). It runs natively on macOS, so the game can stay in CrossOver; nothing is unpacked to disk.

```bash
uv venv .venv && uv pip install --python .venv -r scripts/extract/requirements.txt
.venv/bin/python scripts/extract/extract.py
```

Without `--game-dir` or `POG_GAME_DIR`, it looks for the game in Steam's own library (`~/Library/Application Support/Steam/steamapps/common/ELDEN RING/Game`), then in the Steam library of every CrossOver bottle, and lists where it looked if none has `eldenring.exe`. The first run decrypts the archive indexes (about 3 minutes) and caches them in `.cache/bhd/`; later runs take about 100 seconds.

## Output (`game-data/`, git-ignored)

- `catalog.json`: `items` (weapons, armor, talismans, goods, Ashes of War), `graces`, `bosses`, `places` and `npcs`, each with official `en` and `zh-TW` names, a `dlc` flag, and for items the param ID and icon ID. Weapon infusion and upgrade variants are left out. Graces also carry their map `layer`, `x`/`y` in full-resolution map pixels, the "discovered" event `flag`, their `entity` ID (the save names the last grace rested at by it), and `legacy` when they sit inside a dungeon and were projected onto the open-world map. Bosses carry their "beaten" event `flag`, `otherNames` for duos and second phases, and the same `layer`, `x`, `y` and `legacy` as graces. `pickups` lists every spot where the map layout files place an item lot: the `lot`, its pickup event `flag`, the catalog `items` it gives, and the same `layer`, `x`, `y` and `legacy`. A lot can have several spots, and lots chained after a placed lot share its spot.
- `icons/<iconId>.webp`: item icons (256 px by default; `--icon-size`).
- `eventflag_bst.txt`: where each block of 1000 event flags sits in a save slot, for the save import. It isn't in the game files: it's downloaded from [ER-Save-Lib](https://github.com/ClayAmore/ER-Save-Lib) at a pinned commit and checked against its SHA-256 (the only network access).
- `map/<layer>/{z}/{x}/{y}.jpg`: Leaflet tile pyramids for `overworld`, `underground`, `dlc` and `dlc-underground`, fully revealed, with the map in the top-left corner. `map/index.json` gives each layer's size and maximum zoom.

## Item location report

`scripts/extract/item_locations_report.py` counts the item lots the map layout files give a position, and how many catalog items that places (findings in `docs/architecture.md`). It uses the catalog's own `build_pickups` and writes nothing to `game-data/`; `--json FILE` saves the pickups for inspection.

## How it works

| Step         | Notes                                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.bhd` index | RSA-encrypted; the public keys are read from the player's `eldenring.exe`.                                                                                                                        |
| `.bdt` data  | Files are found by path hash; listed AES ranges are decrypted.                                                                                                                                    |
| DCX          | Kraken via `pyooz`, decoded one 256 KB block at a time (every block resets the decoder, which ooz doesn't handle), or ZSTD.                                                                       |
| Text         | `msg/<lang>/item_dlc02.msgbnd` holds every name table, base game and DLC.                                                                                                                         |
| Params       | `regulation.bin` (AES-256-CBC, public key) gives icon IDs; field offsets come from soulsmods/Paramdex and are checked against row size.                                                           |
| Graces       | `BonfireWarpParam` positions, moved into the open world through `WorldMapLegacyConvParam`, then `pixel = (x − 7040, 16512 − z)` on every layer.                                                   |
| Bosses       | `GameAreaParam` gives each boss's beaten flag and arena. Names come from the health bar each map's `event/*.emevd` shows (shared events from `common_func.emevd` with their arguments filled in). |
| Pickups      | Treasure events in `map/mapstudio/*.msb` give each item lot its holder's spot, projected like graces; lots chained after it share the spot.                                                       |
| Map tiles    | `menu/71_maptile.mtmskbnd` lists, per tile, the mask of the fully revealed variant. Tiles with bit 14 set are outside the map.                                                                    |

Known gap: about 120 tiny or unusual files use an Oodle codec ooz doesn't handle (decoder type 2). None of them are text, icons or map tiles.
