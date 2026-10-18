"""Extract the item catalog, graces, bosses, icons and map tiles from the player's Elden Ring install.

Usage:
    .venv/bin/python scripts/extract/extract.py [--game-dir DIR] [--out DIR]

Everything is read straight from the game's archives; the output folder holds
game assets and must stay out of git.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import os
import re
import struct
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

from er_archive import GameFiles, dcx_decompress
from formats import read_bhf4, read_bnd4, read_emevd, read_fmg, read_mtmsk, read_tpf
from params import LAYOUTS, read_param, read_regulation

REPO = Path(__file__).resolve().parents[2]
DEFAULT_GAME_DIR = Path.home() / (
    "Library/Application Support/CrossOver/Bottles/Elden Ring/drive_c/"
    "Program Files (x86)/Steam/steamapps/common/ELDEN RING/Game"
)

# (catalog type, param, FMG table prefix)
ITEM_TYPES = [
    ("weapon", "EquipParamWeapon", "WeaponName"),
    ("armor", "EquipParamProtector", "ProtectorName"),
    ("talisman", "EquipParamAccessory", "AccessoryName"),
    ("goods", "EquipParamGoods", "GoodsName"),
    ("ash_of_war", "EquipParamGem", "GemName"),
]
OTHER_NAMES = [("place", "PlaceName"), ("npc", "NpcName")]
LANGUAGES = {"en": "engus", "zh-TW": "zhotw"}

MAP_LAYERS = {"M00": "overworld", "M01": "underground", "M10": "dlc", "M11": "dlc-underground"}
TILE = 256


def log(message: str) -> None:
    print(message, flush=True)


def load_names(game: GameFiles) -> dict[str, dict[str, dict[int, str]]]:
    """Return {language: {table: {text id: string}}}, with DLC tables kept apart."""
    names = {}
    for lang, folder in LANGUAGES.items():
        binder = read_bnd4(dcx_decompress(game.get(f"/msg/{folder}/item_dlc02.msgbnd.dcx")))
        names[lang] = {path.split("\\")[-1].removesuffix(".fmg"): read_fmg(raw) for path, raw in binder.items()}
    return names


def lookup(names: dict, lang: str, table: str, text_id: int) -> tuple[str | None, bool]:
    """Return (name, is_dlc) for a text id, checking the base table then the DLC ones."""
    for suffix, dlc in (("", False), ("_dlc01", True), ("_dlc02", True)):
        text = names[lang].get(table + suffix, {}).get(text_id)
        if text and not text.startswith("[ERROR]"):
            return text.strip(), dlc
    return None, False


def build_catalog(game: GameFiles, game_dir: Path) -> dict:
    names = load_names(game)
    regulation = read_regulation(game_dir / "regulation.bin")
    missing_zh = 0
    items = []
    for item_type, param, table in ITEM_TYPES:
        for row_id, fields in read_param(regulation[param], LAYOUTS[param]).items():
            if item_type == "weapon" and row_id % 10000:
                continue  # infusion and upgrade variants share the base weapon's name
            en, dlc = lookup(names, "en", table, row_id)
            if not en:
                continue
            zh, _ = lookup(names, "zh-TW", table, row_id)
            missing_zh += zh is None
            item = {
                "id": f"{item_type}/{row_id}",
                "type": item_type,
                "paramId": row_id,
                "name": {"en": en, "zh-TW": zh},
                "dlc": dlc,
                "icon": fields["iconId"] or None,
            }
            if "goodsType" in fields:
                item["goodsType"] = fields["goodsType"]
            items.append(item)

    others = {}
    for kind, table in OTHER_NAMES:
        ids = sorted({i for t, texts in names["en"].items() if t.startswith(table) for i in texts})
        entries = []
        for text_id in ids:
            en, dlc = lookup(names, "en", table, text_id)
            if en:
                zh, _ = lookup(names, "zh-TW", table, text_id)
                entries.append({"id": f"{kind}/{text_id}", "name": {"en": en, "zh-TW": zh}, "dlc": dlc})
        others[kind + "s"] = entries

    graces = build_graces(regulation, names)
    bosses = build_bosses(game, regulation, names)
    log(f"catalog: {len(items)} items, {len(graces)} graces, {len(bosses)} bosses, {len(others['places'])} places, {len(others['npcs'])} npcs, {missing_zh} items without zh-TW")
    return {"items": items, "graces": graces, "bosses": bosses, **others}


# Open-world map areas: 60 is the Lands Between, 61 the Realm of Shadow. Grid cells are 256 m.
OPEN_WORLD = {60: False, 61: True}
# World meters to full-resolution map pixels, the same for every map layer: one pixel per
# meter, y flipped. Checked by eye against churches, forts and castles on all three maps.
MAP_ORIGIN_X, MAP_ORIGIN_Z = 7040, 16512


def open_world_projector(regulation: dict[str, bytes]):
    """Return a function giving (area, x, z) in its open-world area (meters, x east, z north).

    Spots inside legacy dungeons, caves and catacombs are stored in their own
    map's coordinates; WorldMapLegacyConvParam rows translate between maps, and
    following them leads to area 60 or 61.
    """
    links: dict[tuple, list] = {}
    for row in read_param(regulation["WorldMapLegacyConvParam"], LAYOUTS["WorldMapLegacyConvParam"]).values():
        src, dst = row["src"], row["dst"]
        if src[:3] != dst[:3]:
            links.setdefault(src[:3], []).append((src[3:], dst[:3], dst[3:]))
            links.setdefault(dst[:3], []).append((dst[3:], src[:3], src[3:]))  # rows work both ways

    def to_open_world(cell: tuple, pos: tuple, seen: frozenset = frozenset()):
        if cell[0] in OPEN_WORLD:
            return cell[0], cell[1] * 256 + pos[0], cell[2] * 256 + pos[2]
        candidates = [link for link in links.get(cell, []) if link[1] not in seen]
        # Prefer a direct link to the open world, then the conversion point nearest the spot.
        candidates.sort(key=lambda l: (l[1][0] not in OPEN_WORLD, (l[0][0] - pos[0]) ** 2 + (l[0][2] - pos[2]) ** 2))
        for src_pos, dst_cell, dst_pos in candidates:
            moved = tuple(d + p - s for s, d, p in zip(src_pos, dst_pos, pos))
            found = to_open_world(dst_cell, moved, seen | {cell})
            if found:
                return found
        return None

    return to_open_world


def build_graces(regulation: dict[str, bytes], names: dict) -> list[dict]:
    """Every Site of Grace with its position on its map layer."""
    to_open_world = open_world_projector(regulation)
    graces, skipped = [], 0
    for row_id, row in read_param(regulation["BonfireWarpParam"], LAYOUTS["BonfireWarpParam"]).items():
        en, _ = lookup(names, "en", "PlaceName", row["textId1"])
        cell = (row["areaNo"], row["gridXNo"], row["gridZNo"])
        found = to_open_world(cell, (row["posX"], row["posY"], row["posZ"]))
        if not en or not found:
            skipped += 1
            continue
        area, x, z = found
        zh, _ = lookup(names, "zh-TW", "PlaceName", row["textId1"])
        dlc = OPEN_WORLD[area]
        underground = bool(row["dispMask"] & 2)
        graces.append({
            "id": f"grace/{row_id}",
            "name": {"en": en, "zh-TW": zh},
            "dlc": dlc,
            "layer": "dlc" if dlc else "underground" if underground else "overworld",
            "x": round(x - MAP_ORIGIN_X),
            "y": round(MAP_ORIGIN_Z - z),
            "flag": row["eventflagId"],
            "legacy": area != row["areaNo"],
        })
    if skipped:
        log(f"graces: {skipped} rows skipped (no name or no route to the open world)")
    return graces


# Event script instructions (bank, id): start an event of this map, start a common event,
# show a boss health bar (enabled, entity id, bar slot, NpcName text id).
INIT_EVENT, INIT_COMMON_EVENT, BOSS_HEALTH_BAR = (2000, 0), (2000, 6), (2003, 11)


def map_name(cell: tuple) -> str:
    return "m{:02d}_{:02d}_{:02d}_00".format(*cell)


def flag_map(flag: int) -> str:
    """The map whose event script owns a flag: 1AABB... is m60_AA_BB, 2AABB... m61, AABB... mAA_BB."""
    s = str(flag)
    if len(s) == 10 and s[0] in "12":
        return f"m6{int(s[0]) - 1}_{s[2:4]}_{s[4:6]}_00"
    return f"m{s[0:2]}_{s[2:4]}_00_00"


def boss_health_bars(game: GameFiles, map_names: set[str]) -> dict[str, list[tuple[int, int, set[int]]]]:
    """Every boss health bar each map's event script shows: (NpcName id, entity id, context).

    The context is every 32-bit value in the event that shows it, with its arguments
    filled in, so a bar can be tied to a defeat flag the same event sets or checks.
    """
    common = read_emevd(dcx_decompress(game.get("/event/common_func.emevd.dcx")))

    def u32s(raw: bytes) -> set[int]:
        return {struct.unpack_from("<I", raw, o)[0] for o in range(0, len(raw) - 3, 4)}

    def run(events: dict, event_id: int, args: bytes):
        instructions, params = events[event_id]
        filled = [bytearray(a) for _, _, a in instructions]
        for index, target, source, length in params:
            filled[index][target : target + length] = args[source : source + length]
        context = u32s(args) | {event_id}
        for raw in filled:
            context |= u32s(raw)
        for (bank, instruction_id, _), raw in zip(instructions, filled):
            if (bank, instruction_id) == BOSS_HEALTH_BAR and len(raw) >= 16 and raw[0] == 1:
                (entity,), (name_id,) = struct.unpack_from("<i", raw, 4), struct.unpack_from("<i", raw, 12)
                yield name_id, entity, context

    bars = {}
    for name in sorted(map_names):
        raw = game.get(f"/event/{name}.emevd.dcx")
        events = read_emevd(dcx_decompress(raw)) if raw else {}
        found = []
        for event_id, (instructions, _) in events.items():
            found += run(events, event_id, b"")
            for bank, instruction_id, args in instructions:
                if (bank, instruction_id) in (INIT_EVENT, INIT_COMMON_EVENT) and len(args) >= 8:
                    (target,) = struct.unpack_from("<I", args, 4)
                    source = common if (bank, instruction_id) == INIT_COMMON_EVENT else events
                    if target in source:
                        found += run(source, target, args[8:])
        bars[name] = found
    return bars


def build_bosses(game: GameFiles, regulation: dict[str, bytes], names: dict) -> list[dict]:
    """Every boss with a "beaten" flag (GameAreaParam), named after its health bar.

    The param holds the flag and arena but no name; the map's event script shows
    the health bar, naming the boss's entity. A row's own id, then its flag, is
    usually that entity; failing both, a bar whose event uses the flag counts.
    Duos and bosses with a second phase have several names, the first one main.
    """
    to_open_world = open_world_projector(regulation)
    underground_cells = {
        (row["areaNo"], row["gridXNo"], row["gridZNo"]): bool(row["dispMask"] & 2)
        for row in read_param(regulation["BonfireWarpParam"], LAYOUTS["BonfireWarpParam"]).values()
    }
    rows = {
        row_id: row
        for row_id, row in read_param(regulation["GameAreaParam"], LAYOUTS["GameAreaParam"]).items()
        if row["defeatBossFlagId"]
    }
    bars = boss_health_bars(game, {m for r in rows.values() for m in (map_name(r["bossMap"]), flag_map(r["defeatBossFlagId"]))})

    def npc_name(lang: str, name_id: int) -> tuple[str | None, bool]:
        name, dlc = lookup(names, lang, "NpcName", name_id)
        return (None, dlc) if not name or "dummy" in name.lower() else (name, dlc)

    bosses, unnamed, unplaced = [], [], 0
    for row_id, row in rows.items():
        flag, cell = row["defeatBossFlagId"], row["bossMap"]
        tiers: tuple[list, list, list] = ([], [], [])  # bar on the row's entity, on the flag, in the flag's event
        for m in dict.fromkeys((map_name(cell), flag_map(flag))):
            for name_id, entity, context in bars[m]:
                if npc_name("en", name_id)[0] is None:
                    continue
                tier = 0 if entity == row_id else 1 if entity == flag else 2 if flag in context else None
                if tier is not None:
                    tiers[tier].append(name_id)
        name_ids = list(dict.fromkeys(next((t for t in tiers if t), [])))
        localized = [{lang: npc_name(lang, i)[0] for lang in LANGUAGES} for i in name_ids]
        localized = [n for i, n in enumerate(localized) if n["en"] not in {m["en"] for m in localized[:i]}]
        if not localized:
            unnamed.append(row_id)
            continue
        boss = {
            "id": f"boss/{row_id}",
            "name": localized[0],
            "dlc": npc_name("en", name_ids[0])[1],  # until its position says which world
            "flag": flag,
        }
        if len(localized) > 1:
            boss["otherNames"] = localized[1:]
        found = to_open_world(cell, row["bossPos"]) if any(row["bossPos"]) else None
        if found:
            area, x, z = found
            underground = underground_cells.get(cell, False)
            boss["dlc"] = OPEN_WORLD[area]
            boss.update({
                "layer": "dlc" if OPEN_WORLD[area] else "underground" if underground else "overworld",
                "x": round(x - MAP_ORIGIN_X),
                "y": round(MAP_ORIGIN_Z - z),
                "legacy": area != cell[0],
            })
        else:
            unplaced += 1
        bosses.append(boss)
    if unnamed:
        log(f"bosses: {len(unnamed)} rows skipped (no health bar names them): {unnamed}")
    if unplaced:
        log(f"bosses: {unplaced} without a map position")
    return bosses


def tpf_image(data: bytes) -> Image.Image:
    textures = read_tpf(dcx_decompress(data))
    return Image.open(io.BytesIO(next(iter(textures.values()))))


def extract_icons(game: GameFiles, icon_ids: set[int], out: Path, size: int) -> None:
    out.mkdir(parents=True, exist_ok=True)
    archive, entry = game.find("/menu/hi/00_solo.tpfbdt")
    index = {path.split("\\")[-1]: (offset, length) for path, offset, length in read_bhf4(game.get("/menu/hi/00_solo.tpfbhd"))}
    written = missing = 0
    for icon_id in sorted(icon_ids):
        found = index.get(f"MENU_Knowledge_{icon_id:05d}.tpf.dcx")
        if not found:
            missing += 1
            continue
        image = tpf_image(archive.read(entry, *found)).convert("RGBA")
        image.resize((size, size), Image.LANCZOS).save(out / f"{icon_id}.webp", quality=90)
        written += 1
    log(f"icons: {written} written, {missing} referenced but not found")


def extract_maps(game: GameFiles, out: Path) -> None:
    archive, entry = game.find("/menu/71_maptile.tpfbdt")
    tiles = {}
    for path, offset, length in read_bhf4(game.get("/menu/71_maptile.tpfbhd")):
        m = re.search(r"_(M\d\d)_L0_(\d\d)_(\d\d)_([0-9a-f]{8})", path)
        if m:
            tiles[(m[1], int(m[2]), int(m[3]), int(m[4], 16))] = (offset, length)
    mask_files = read_bnd4(dcx_decompress(game.get("/menu/71_maptile.mtmskbnd.dcx")))

    index = {}
    for map_id, layer in MAP_LAYERS.items():
        mask_raw = next(raw for path, raw in mask_files.items() if path.endswith(f"MENU_MapTile_{map_id}.mtmsk"))
        masks = {(x, y): mask for (lod, x, y), mask in read_mtmsk(mask_raw).items() if lod == 0}
        coords = {(x, y) for (m, x, y, _) in tiles if m == map_id}
        grid = max(max(x, y) for x, y in coords) + 1
        max_zoom = math.ceil(math.log2(grid))
        layer_dir = out / layer
        written = 0
        for x, y in sorted(coords):
            mask = masks.get((x, y), 0)
            if mask & (1 << 14):  # always outside the playable map
                continue
            found = tiles.get((map_id, x, y, mask)) or tiles.get((map_id, x, y, 0))
            if not found:
                continue
            path = layer_dir / str(max_zoom) / str(x) / f"{grid - 1 - y}.jpg"
            path.parent.mkdir(parents=True, exist_ok=True)
            tpf_image(archive.read(entry, *found)).convert("RGB").save(path, quality=88)
            written += 1
        build_pyramid(layer_dir, max_zoom)
        index[layer] = {"mapId": map_id, "tileSize": TILE, "maxZoom": max_zoom, "size": grid * TILE}
        log(f"map {layer}: {written} tiles at zoom {max_zoom}, {grid}x{grid} grid")
    (out / "index.json").write_text(json.dumps(index, indent=1) + "\n")


def build_pyramid(layer_dir: Path, max_zoom: int) -> None:
    """Make each lower zoom level by shrinking 2x2 blocks of the level above."""
    for zoom in range(max_zoom - 1, -1, -1):
        children = {}
        for path in (layer_dir / str(zoom + 1)).glob("*/*.jpg"):
            children[(int(path.parent.name), int(path.stem))] = path
        parents = {(x // 2, y // 2) for x, y in children}
        for px, py in parents:
            canvas = Image.new("RGB", (TILE * 2, TILE * 2))
            for dx in (0, 1):
                for dy in (0, 1):
                    child = children.get((px * 2 + dx, py * 2 + dy))
                    if child:
                        canvas.paste(Image.open(child), (dx * TILE, dy * TILE))
            path = layer_dir / str(zoom) / str(px) / f"{py}.jpg"
            path.parent.mkdir(parents=True, exist_ok=True)
            canvas.resize((TILE, TILE), Image.LANCZOS).save(path, quality=88)


# Where each block of 1000 event flags sits in a save slot. The community
# reverse-engineered it from the running game; it isn't in the game files.
# Pinned to one commit of ER-Save-Lib and checked, since that repo has no
# license and is downloaded rather than copied into this one.
FLAG_TABLE_URL = (
    "https://raw.githubusercontent.com/ClayAmore/ER-Save-Lib/"
    "d54d9282527dfa55a6adea6b0b3d77564aff726b/src/res/eventflag_bst.txt"
)
FLAG_TABLE_SHA256 = "d3cd15912bf2c4ff7c67a1f3ec2aff78ec887e4d8e435e3cab036f80cb8f4c82"


def download_flag_table(out: Path) -> None:
    if out.exists() and hashlib.sha256(out.read_bytes()).hexdigest() == FLAG_TABLE_SHA256:
        return
    log("downloading the event flag table for the save import")
    with urllib.request.urlopen(FLAG_TABLE_URL, timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != FLAG_TABLE_SHA256:
        raise RuntimeError("the downloaded event flag table doesn't match its pinned checksum")
    out.write_bytes(data)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--game-dir", type=Path, default=Path(os.environ.get("ROUTE_OF_GRACE_GAME_DIR", DEFAULT_GAME_DIR)))
    parser.add_argument("--out", type=Path, default=REPO / "game-data")
    parser.add_argument("--icon-size", type=int, default=256)
    parser.add_argument("--skip-icons", action="store_true")
    parser.add_argument("--skip-map", action="store_true")
    args = parser.parse_args()

    if not (args.game_dir / "eldenring.exe").exists():
        print(f"eldenring.exe not found in {args.game_dir}; pass --game-dir", file=sys.stderr)
        return 1

    started = time.time()
    log("opening archives (the first run decrypts their indexes and takes a few minutes)")
    game = GameFiles(args.game_dir, REPO / ".cache" / "bhd")

    args.out.mkdir(parents=True, exist_ok=True)
    download_flag_table(args.out / "eventflag_bst.txt")
    catalog = build_catalog(game, args.game_dir)
    if not args.skip_icons:
        extract_icons(game, {item["icon"] for item in catalog["items"] if item["icon"]}, args.out / "icons", args.icon_size)
    if not args.skip_map:
        extract_maps(game, args.out / "map")
    (args.out / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    log(f"done in {time.time() - started:.0f}s -> {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
