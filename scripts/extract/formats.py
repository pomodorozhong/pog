"""Parsers for the FromSoftware container and text formats the extractor needs."""

from __future__ import annotations

import struct


def _reverse_bits(b: int) -> int:
    return int(f"{b:08b}"[::-1], 2)


def read_bnd4(data: bytes) -> dict[str, bytes]:
    """Return {file name: raw bytes} for a little-endian BND4 binder."""
    if data[:4] != b"BND4":
        raise ValueError("not a BND4 binder")
    return {name: data[offset : offset + size] for name, offset, size in _binder_entries(data)}


def read_bhf4(data: bytes) -> list[tuple[str, int, int]]:
    """Return (name, offset, size) for each file of a split binder's header.

    The offsets point into the matching .*bdt data file.
    """
    if data[:4] != b"BHF4":
        raise ValueError("not a BHF4 binder header")
    return _binder_entries(data)


def _binder_entries(data: bytes) -> list[tuple[str, int, int]]:
    (count,) = struct.unpack_from("<i", data, 0x0C)
    (header_size,) = struct.unpack_from("<q", data, 0x20)
    unicode = data[0x30] != 0
    raw_format = data[0x31]
    bit_big_endian = data[0x0A] == 0  # stored inverted
    fmt = raw_format if bit_big_endian else _reverse_bits(raw_format)
    has_ids, has_names = fmt & 0x02, fmt & 0x0C
    long_offsets, compression = fmt & 0x10, fmt & 0x20

    files = []
    for i in range(count):
        p = 0x40 + i * header_size
        p += 8  # flags, padding, -1
        (size,) = struct.unpack_from("<q", data, p)
        p += 8
        if compression:
            p += 8
        if long_offsets:
            (offset,) = struct.unpack_from("<q", data, p)
            p += 8
        else:
            (offset,) = struct.unpack_from("<I", data, p)
            p += 4
        file_id = None
        if has_ids:
            (file_id,) = struct.unpack_from("<i", data, p)
            p += 4
        name = str(file_id)
        if has_names:
            (name_offset,) = struct.unpack_from("<I", data, p)
            name = _read_cstring(data, name_offset, unicode)
        files.append((name, offset, size))
    return files


def read_tpf(data: bytes) -> dict[str, bytes]:
    """Return {texture name: DDS bytes} for a PC TPF texture pack."""
    if data[:4] != b"TPF\0":
        raise ValueError("not a TPF")
    (count,) = struct.unpack_from("<i", data, 8)
    encoding = data[0x0E]  # 1 = UTF-16 names
    textures = {}
    for i in range(count):
        p = 0x10 + i * 0x14
        offset, size = struct.unpack_from("<Ii", data, p)
        (name_offset,) = struct.unpack_from("<I", data, p + 0x0C)
        name = _read_cstring(data, name_offset, encoding == 1)
        textures[name] = data[offset : offset + size]
    return textures


def _read_cstring(data: bytes, offset: int, unicode: bool) -> str:
    if unicode:
        end = offset
        while data[end : end + 2] != b"\0\0":
            end += 2
        return data[offset:end].decode("utf-16-le")
    end = data.index(b"\0", offset)
    return data[offset:end].decode("shift_jis", errors="replace")


def read_fmg(data: bytes) -> dict[int, str]:
    """Return {text id: string} for a version 2 (64-bit) FMG text table."""
    if not data:
        return {}
    if data[1] != 0 or data[2] != 2:
        raise ValueError("only little-endian FMG version 2 is supported")
    group_count, _string_count = struct.unpack_from("<ii", data, 0x0C)
    (offsets_at,) = struct.unpack_from("<q", data, 0x18)
    texts = {}
    for g in range(group_count):
        index, first, last, _ = struct.unpack_from("<iiii", data, 0x28 + g * 16)
        for k, text_id in enumerate(range(first, last + 1)):
            (str_offset,) = struct.unpack_from("<q", data, offsets_at + (index + k) * 8)
            if str_offset > 0:
                texts[text_id] = _read_cstring(data, str_offset, True)
    return texts


def read_mtmsk(data: bytes) -> dict[tuple[int, int, int], int]:
    """Return {(lod, x, y): mask} from a map tile mask list (XML).

    The mask names the tile variant that shows the fully revealed map.
    """
    import xml.etree.ElementTree as ET

    masks = {}
    for entry in ET.fromstring(data).iter("MapTileMask"):
        if entry.get("exists") != "1":
            continue
        lod, coords = divmod(int(entry.get("id")), 10000)
        x, y = divmod(coords, 100)
        masks[(lod, x, y)] = int(entry.get("mask"))
    return masks


Instruction = tuple[int, int, bytes]  # bank, id, argument bytes


def read_emevd(data: bytes) -> dict[int, tuple[list[Instruction], list[tuple[int, int, int, int]]]]:
    """Return {event id: (instructions, parameters)} for a 64-bit EMEVD event script.

    Each parameter (instruction index, target byte, source byte, length) copies
    bytes of the event's own arguments over one instruction's arguments.
    """
    if data[:4] != b"EVD\0":
        raise ValueError("not an EMEVD")
    q = lambda offset: struct.unpack_from("<q", data, offset)[0]
    event_count, events_at, instructions_at = q(0x10), q(0x18), q(0x28)
    params_at, args_at = q(0x58), q(0x78)
    events = {}
    for e in range(event_count):
        event_id, count, offset, param_count, param_offset = struct.unpack_from("<qqqqq", data, events_at + e * 0x30)
        instructions = []
        for i in range(count):
            bank, instruction_id, length, arg_offset = struct.unpack_from("<iiqq", data, instructions_at + offset + i * 0x20)
            instructions.append((bank, instruction_id, data[args_at + arg_offset : args_at + arg_offset + length]))
        params = [struct.unpack_from("<qqqi", data, params_at + param_offset + p * 0x20) for p in range(param_count)]
        events[event_id] = (instructions, params)
    return events


MSB_TREASURE = 4  # event type


def read_msb_treasures(data: bytes) -> list[dict]:
    """Return the treasure events of an Elden Ring map layout (MSB): item lot, holder part, position.

    The layout follows SoulsFormats' MSBE. Positions are in the map's own coordinates;
    a treasure whose part index is out of range gets no position.
    """
    if data[:4] != b"MSB ":
        raise ValueError("not an MSB")
    params, pos = {}, 0x10
    while pos:
        _version, count = struct.unpack_from("<ii", data, pos)
        (name_offset,) = struct.unpack_from("<q", data, pos + 8)
        params[_read_cstring(data, name_offset, True)] = struct.unpack_from(f"<{count - 1}q", data, pos + 16)
        (pos,) = struct.unpack_from("<q", data, pos + 16 + (count - 1) * 8)

    parts = []
    for offset in params["PARTS_PARAM_ST"]:
        (name_offset,) = struct.unpack_from("<q", data, offset)
        parts.append((_read_cstring(data, offset + name_offset, True), struct.unpack_from("<3f", data, offset + 0x20)))

    treasures = []
    for offset in params["EVENT_PARAM_ST"]:
        (event_type,) = struct.unpack_from("<I", data, offset + 0x0C)
        if event_type != MSB_TREASURE:
            continue
        (type_data,) = struct.unpack_from("<q", data, offset + 0x20)
        part_index, item_lot = struct.unpack_from("<i4xi", data, offset + type_data + 8)
        part = parts[part_index] if 0 <= part_index < len(parts) else None
        treasures.append({
            "lot": item_lot,
            "part": part and part[0],
            "position": part and part[1],
            "inChest": bool(data[offset + type_data + 0x40]),
        })
    return treasures
