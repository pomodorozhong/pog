"""Report how many item lots the map layout files (MSB) give a position (spike #8).

Usage:
    .venv/bin/python scripts/extract/item_locations_report.py [--game-dir DIR] [--json FILE]

Uses the extractor's pickups (`build_pickups`): every MSB's treasure events,
each item lot followed to the lots chained after it, projected onto the map
layers like graces. Nothing is written to game-data/; --json saves the
pickups for inspection.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import sys
from pathlib import Path

from er_archive import GameFiles
from extract import REPO, build_catalog, find_game_dir


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--game-dir", type=Path, default=os.environ.get("POG_GAME_DIR"), help="default: found in Steam or a CrossOver bottle")
    parser.add_argument("--json", type=Path)
    args = parser.parse_args()
    args.game_dir = Path(args.game_dir) if args.game_dir else find_game_dir()
    if args.game_dir is None or not (args.game_dir / "eldenring.exe").exists():
        print(f"eldenring.exe not found in {args.game_dir}; pass --game-dir", file=sys.stderr)
        return 1

    game = GameFiles(args.game_dir, REPO / ".cache" / "bhd")
    stats: dict = {}
    pickups = build_catalog(game, args.game_dir, stats)["pickups"]

    placed_items = {item for p in pickups for item in p["items"]}
    by_type = collections.Counter(i.split("/")[0] for i in placed_items)
    totals = collections.Counter(i.split("/")[0] for i in stats["inLots"])
    layers = collections.Counter(p["layer"] for p in pickups)

    print(f"map layouts: {stats['layouts']} found, {len(stats['unread'])} unreadable (Oodle codec ooz lacks): {' '.join(stats['unread'])}")
    print(f"treasure events: {stats['events']}; {stats['noPart']} without a holder part; {stats['unprojected']} not projectable")
    print(f"map lots with items: {stats['lotsWithItems']}; with a treasure entry: {stats['placedLots']}; reached from a treasure (chains included): {stats['reachedLots']}")
    print(f"catalog items in a map lot: {len(stats['inLots'])}; with a position: {len(placed_items)}")
    print("  by type: " + ", ".join(f"{t} {by_type[t]}/{totals[t]}" for t in sorted(totals)))
    print(f"pickup spots: {len(pickups)}, " + ", ".join(f"{layer} {n}" for layer, n in layers.most_common()))
    print(f"pickups without a pickup flag: {sum(1 for p in pickups if p['flag'] is None)}")
    if args.json:
        args.json.write_text(json.dumps(pickups, indent=1) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
