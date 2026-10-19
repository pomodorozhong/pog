"""Report how many item lots the map layout files (MSB) give a position (spike #8).

Usage:
    .venv/bin/python scripts/extract/item_locations_report.py [--game-dir DIR] [--json FILE]

Reads every MSB's treasure events, follows each item lot to the lots chained
after it, and projects the holder's position onto the map layers like graces.
Nothing is written to game-data/; --json saves the placements for inspection.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import sys
from pathlib import Path

from er_archive import GameFiles, dcx_decompress
from extract import DEFAULT_GAME_DIR, MAP_ORIGIN_X, MAP_ORIGIN_Z, OPEN_WORLD, REPO, build_catalog, open_world_projector
from formats import read_msb_treasures
from params import LAYOUTS, read_param, read_regulation

LOT_ITEM_TYPES = {1: "goods", 2: "weapon", 3: "armor", 4: "talisman", 5: "ash_of_war"}


def msb_names(game: GameFiles) -> list[str]:
    """Every map layout in the archives: legacy maps, then open-world tiles of 256 m, 512 m and 1 km."""
    candidates = [f"m{area}_{block:02d}_00_00" for area in range(10, 60) for block in range(100)]
    candidates += [
        f"m{area}_{x:02d}_{z:02d}_{level:02d}" for area in OPEN_WORLD for x in range(100) for z in range(100) for level in range(3)
    ]
    return [name for name in candidates if game.find(f"/map/mapstudio/{name}.msb.dcx")]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--game-dir", type=Path, default=Path(os.environ.get("ROUTE_OF_GRACE_GAME_DIR", DEFAULT_GAME_DIR)))
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    if not (args.game_dir / "eldenring.exe").exists():
        print(f"eldenring.exe not found in {args.game_dir}; pass --game-dir", file=sys.stderr)
        return 1

    game = GameFiles(args.game_dir, REPO / ".cache" / "bhd")
    regulation = read_regulation(args.game_dir / "regulation.bin")
    catalog = build_catalog(game, args.game_dir)
    known = {item["id"] for item in catalog["items"]}
    to_open_world = open_world_projector(regulation)
    underground_cells = {
        (row["areaNo"], row["gridXNo"], row["gridZNo"]): bool(row["dispMask"] & 2)
        for row in read_param(regulation["BonfireWarpParam"], LAYOUTS["BonfireWarpParam"]).values()
    }
    lots = {
        row_id: row
        for row_id, row in read_param(regulation["ItemLotParam_map"], LAYOUTS["ItemLotParam_map"]).items()
        if any(i > 0 and c > 0 for i, c in zip(row["lotItemId"], row["lotItemCategory"]))
    }

    def project(map_name: str, position: tuple) -> dict | None:
        area, x, z, level = (int(part) for part in map_name[1:].split("_"))
        if area in OPEN_WORLD:
            # Tiles of 512 m and 1 km measure from their center; 256 m tiles from their corner.
            size = 256 << level
            offset = size / 2 if level else 0
            found = (area, x * size + offset + position[0], z * size + offset + position[2])
            cell = (area, int(found[1] // 256), int(found[2] // 256))
        else:
            cell = (area, x, z)
            found = to_open_world(cell, position)
        if not found:
            return None
        world, wx, wz = found
        layer = "dlc" if OPEN_WORLD[world] else "underground" if underground_cells.get(cell) else "overworld"
        return {"layer": layer, "x": round(wx - MAP_ORIGIN_X), "y": round(MAP_ORIGIN_Z - wz)}

    names = msb_names(game)
    placements: dict[int, list[dict]] = collections.defaultdict(list)
    unread, no_part, unprojected, events = [], 0, 0, 0
    for name in names:
        try:
            treasures = read_msb_treasures(dcx_decompress(game.get(f"/map/mapstudio/{name}.msb.dcx")))
        except ValueError:
            unread.append(name)
            continue
        for treasure in treasures:
            events += 1
            if not treasure["position"]:
                no_part += 1
                continue
            spot = project(name, treasure["position"])
            if not spot:
                unprojected += 1
                continue
            placements[treasure["lot"]].append({"map": name, "part": treasure["part"], "inChest": treasure["inChest"], **spot})

    # Picking up a lot also gives the rows right after it, up to the next gap or placed lot.
    reached: dict[int, int] = {}
    for lot in placements:
        following = lot
        while following in lots and (following == lot or following not in placements):
            reached[following] = lot
            following += 1

    def items_of(lot: int) -> set[str]:
        row = lots[lot]
        found = set()
        for item_id, category in zip(row["lotItemId"], row["lotItemCategory"]):
            if item_id > 0 and category in LOT_ITEM_TYPES:
                kind = LOT_ITEM_TYPES[category]
                found.add(f"{kind}/{item_id - item_id % 10000 if kind == 'weapon' else item_id}")
        return found & known

    in_lots = set().union(*(items_of(lot) for lot in lots))
    placed_items = set().union(*(items_of(lot) for lot in reached))
    by_type = collections.Counter(i.split("/")[0] for i in placed_items)
    totals = collections.Counter(i.split("/")[0] for i in in_lots)
    layers = collections.Counter(s["layer"] for spots in placements.values() for s in spots)

    print(f"map layouts: {len(names)} found, {len(unread)} unreadable (Oodle codec ooz lacks): {' '.join(unread)}")
    print(f"treasure events: {events}; {no_part} without a holder part; {unprojected} not projectable")
    print(f"item lots with a treasure entry: {len(placements)} ({len(set(placements) & set(lots))} are map lots with items)")
    print(f"map lots with items: {len(lots)}; reached from a treasure (chains included): {len(reached)}")
    print(f"catalog items in a map lot: {len(in_lots)}; with a position: {len(placed_items)}")
    print("  by type: " + ", ".join(f"{t} {by_type[t]}/{totals[t]}" for t in sorted(totals)))
    print("treasure spots by layer: " + ", ".join(f"{layer} {n}" for layer, n in layers.most_common()))
    if args.json:
        args.json.write_text(json.dumps({"placements": placements, "reached": reached}, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
