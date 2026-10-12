"""Read the item params out of regulation.bin."""

from __future__ import annotations

import struct
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from er_archive import dcx_decompress
from formats import read_bnd4

# Publicly known Elden Ring regulation key (as used by SoulsFormats).
REGULATION_KEY = bytes.fromhex("99BFFC366A6BC8C6F5827D093602D676C42892A01C207FB024D3AF4E493FEF99")

# Field offsets computed from the soulsmods/Paramdex ER definitions. The row
# size is checked against the param file, so a layout change fails loudly.
LAYOUTS = {
    "EquipParamWeapon": {"size": 664, "iconId": (190, "<H")},
    "EquipParamProtector": {"size": 416, "iconId": (166, "<H")},  # iconIdM
    "EquipParamAccessory": {"size": 96, "iconId": (38, "<H")},
    "EquipParamGoods": {"size": 176, "iconId": (48, "<H"), "goodsType": (62, "<B")},
    "EquipParamGem": {"size": 96, "iconId": (4, "<H")},
}


def read_regulation(path: Path) -> dict[str, bytes]:
    data = path.read_bytes()
    plain = Cipher(algorithms.AES(REGULATION_KEY), modes.CBC(data[:16])).decryptor().update(data[16:])
    return {name.split("\\")[-1].removesuffix(".param"): raw for name, raw in read_bnd4(dcx_decompress(plain)).items()}


def read_param(raw: bytes, layout: dict) -> dict[int, dict[str, int]]:
    """Return {row id: {field: value}} for the fields named in the layout."""
    (count,) = struct.unpack_from("<H", raw, 0x0A)
    rows = [struct.unpack_from("<iiq", raw, 0x40 + i * 24)[::2] for i in range(count)]
    if count > 1 and rows[1][1] - rows[0][1] != layout["size"]:
        raise ValueError(f"row size {rows[1][1] - rows[0][1]} != expected {layout['size']}")
    fields = {k: v for k, v in layout.items() if k != "size"}
    return {
        row_id: {name: struct.unpack_from(fmt, raw, offset + field_offset)[0] for name, (field_offset, fmt) in fields.items()}
        for row_id, offset in rows
    }
