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
