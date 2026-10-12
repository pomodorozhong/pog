# Game data extractor

Reads the item catalog, icons and map tiles straight out of an installed copy of Elden Ring (base game and Shadow of the Erdtree). It runs natively on macOS, so the game can stay in CrossOver; nothing is unpacked to disk.

```bash
uv venv .venv && uv pip install --python .venv -r scripts/extract/requirements.txt
.venv/bin/python scripts/extract/extract.py
```

The default game folder is the "Elden Ring" CrossOver bottle. Use `--game-dir` or `ROUTE_OF_GRACE_GAME_DIR` to point elsewhere. The first run decrypts the archive indexes (about 3 minutes) and caches them in `.cache/bhd/`; later runs take about 100 seconds.

## Output (`game-data/`, git-ignored)

- `catalog.json`: `items` (weapons, armor, talismans, goods, Ashes of War), `graces`, `places` and `npcs`, each with official `en` and `zh-TW` names, a `dlc` flag, and for items the param ID and icon ID. Weapon infusion and upgrade variants are left out. Graces also carry their map `layer`, `x`/`y` in full-resolution map pixels, the "discovered" event `flag`, and `legacy` when they sit inside a dungeon and were projected onto the open-world map.
- `icons/<iconId>.webp`: item icons (256 px by default; `--icon-size`).
- `map/<layer>/{z}/{x}/{y}.jpg`: Leaflet tile pyramids for `overworld`, `underground`, `dlc` and `dlc-underground`, fully revealed, with the map in the top-left corner. `map/index.json` gives each layer's size and maximum zoom.

## How it works

| Step         | Notes                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `.bhd` index | RSA-encrypted; the public keys are read from the player's `eldenring.exe`.                                                                      |
| `.bdt` data  | Files are found by path hash; listed AES ranges are decrypted.                                                                                  |
| DCX          | Kraken via `pyooz`, decoded one 256 KB block at a time (every block resets the decoder, which ooz doesn't handle), or ZSTD.                     |
| Text         | `msg/<lang>/item_dlc02.msgbnd` holds every name table, base game and DLC.                                                                       |
| Params       | `regulation.bin` (AES-256-CBC, public key) gives icon IDs; field offsets come from soulsmods/Paramdex and are checked against row size.         |
| Graces       | `BonfireWarpParam` positions, moved into the open world through `WorldMapLegacyConvParam`, then `pixel = (x − 7040, 16512 − z)` on every layer. |
| Map tiles    | `menu/71_maptile.mtmskbnd` lists, per tile, the mask of the fully revealed variant. Tiles with bit 14 set are outside the map.                  |

Known gap: about 120 tiny or unusual files use an Oodle codec ooz doesn't handle (decoder type 2). None of them are text, icons or map tiles.
