"""Read files straight out of Elden Ring's encrypted .bhd/.bdt archives.

Runs natively on macOS: the RSA keys are read from the player's own
eldenring.exe, nothing is unpacked to disk, and only requested files are read.
"""

from __future__ import annotations

import base64
import re
import struct
from dataclasses import dataclass
from pathlib import Path

import ooz
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

ARCHIVES = ["Data0", "Data1", "Data2", "Data3", "DLC", "sd/sd", "sd/sd_dlc02"]


def path_hash(path: str) -> int:
    path = path.lower().replace("\\", "/")
    if not path.startswith("/"):
        path = "/" + path
    h = 0
    for c in path:
        h = (h * 0x85 + ord(c)) & 0xFFFFFFFFFFFFFFFF
    return h


def read_rsa_keys(exe: Path) -> list[tuple[int, int]]:
    data = exe.read_bytes()
    keys = []
    pattern = rb"-----BEGIN RSA PUBLIC KEY-----([A-Za-z0-9+/=\r\n]+)-----END RSA PUBLIC KEY-----"
    for m in re.finditer(pattern, data):
        der = base64.b64decode(b"".join(m.group(1).split()))
        keys.append(_parse_pkcs1(der))
    return keys


def _parse_pkcs1(der: bytes) -> tuple[int, int]:
    def read(pos: int) -> tuple[int, int, int]:
        tag = der[pos]
        length = der[pos + 1]
        pos += 2
        if length & 0x80:
            n = length & 0x7F
            length = int.from_bytes(der[pos : pos + n], "big")
            pos += n
        return tag, pos, length

    _, pos, _ = read(0)  # SEQUENCE
    _, pos, ln = read(pos)
    modulus = int.from_bytes(der[pos : pos + ln], "big")
    _, pos2, ln2 = read(pos + ln)
    exponent = int.from_bytes(der[pos2 : pos2 + ln2], "big")
    return modulus, exponent


def rsa_decrypt(data: bytes, key: tuple[int, int]) -> bytes:
    n, e = key
    size = (n.bit_length() + 7) // 8
    out = bytearray()
    for i in range(0, len(data) - size + 1, size):
        m = pow(int.from_bytes(data[i : i + size], "big"), e, n)
        out += m.to_bytes(size, "big")[1:]
    return bytes(out)


@dataclass
class Entry:
    hash: int
    padded_size: int
    size: int
    offset: int
    aes_key: bytes | None
    aes_ranges: list[tuple[int, int]]


class Archive:
    def __init__(self, bhd: Path, keys: list[tuple[int, int]], cache_dir: Path | None = None):
        self.bdt = bhd.with_suffix(".bdt")
        stat = bhd.stat()
        cached = cache_dir / f"{bhd.stem}-{stat.st_size}-{int(stat.st_mtime)}.bhd5" if cache_dir else None
        if cached and cached.exists():
            header = cached.read_bytes()
        else:
            header = self._decrypt_header(bhd, keys)
            if cached:
                cached.parent.mkdir(parents=True, exist_ok=True)
                cached.write_bytes(header)
        self.entries = _parse_bhd5(header)

    @staticmethod
    def _decrypt_header(bhd: Path, keys: list[tuple[int, int]]) -> bytes:
        raw = bhd.read_bytes()
        size = 256
        for key in keys:
            if rsa_decrypt(raw[:size], key)[:4] == b"BHD5":
                return rsa_decrypt(raw, key)
        raise ValueError(f"no key decrypts {bhd.name}")

    def read(self, entry: Entry, start: int = 0, length: int | None = None) -> bytes:
        """Read (part of) an entry, decrypting any AES ranges it overlaps."""
        total = entry.size or entry.padded_size
        end = total if length is None else min(total, start + length)
        # AES works in 16-byte blocks, so widen the read to block boundaries.
        lo, hi = start & ~15, min((end + 15) & ~15, entry.padded_size)
        with self.bdt.open("rb") as f:
            f.seek(entry.offset + lo)
            data = bytearray(f.read(hi - lo))
        if entry.aes_key:
            dec = Cipher(algorithms.AES(entry.aes_key), modes.ECB()).decryptor()
            for r_start, r_end in entry.aes_ranges:
                a, b = max(r_start, lo), min(r_end, hi)
                if r_start == -1 or b <= a:
                    continue
                data[a - lo : b - lo] = dec.update(bytes(data[a - lo : b - lo]))
        return bytes(data[start - lo : end - lo])


def _parse_bhd5(b: bytes) -> dict[int, Entry]:
    bucket_count, buckets_offset = struct.unpack_from("<ii", b, 0x10)
    entries = {}
    for i in range(bucket_count):
        count, offset = struct.unpack_from("<ii", b, buckets_offset + i * 8)
        for j in range(count):
            p = offset + j * 40
            h, padded, size, off, _sha, aes = struct.unpack_from("<QiiqqQ", b, p)
            key, ranges = None, []
            if aes:
                key = b[aes : aes + 16]
                (n,) = struct.unpack_from("<i", b, aes + 16)
                ranges = [struct.unpack_from("<qq", b, aes + 20 + k * 16) for k in range(n)]
            entries[h] = Entry(h, padded, size, off, key, ranges)
    return entries


class GameFiles:
    def __init__(self, game_dir: Path, cache_dir: Path | None = None):
        keys = read_rsa_keys(game_dir / "eldenring.exe")
        self.archives: list[Archive] = []
        for name in ARCHIVES:
            bhd = game_dir / f"{name}.bhd"
            if bhd.exists():
                self.archives.append(Archive(bhd, keys, cache_dir))

    def find(self, path: str) -> tuple[Archive, Entry] | None:
        h = path_hash(path)
        for a in self.archives:
            if h in a.entries:
                return a, a.entries[h]
        return None

    def get(self, path: str) -> bytes | None:
        found = self.find(path)
        return found[0].read(found[1]) if found else None


def dcx_decompress(data: bytes) -> bytes:
    if data[:4] != b"DCX\0":
        return data
    size, csize = struct.unpack_from(">II", data, 0x1C)
    algo = data[0x28:0x2C]
    start = data.index(b"DCA\0") + 8
    payload = data[start : start + csize]
    if algo == b"KRAK":
        return kraken_decompress(payload, size)
    if algo == b"ZSTD":
        import zstandard

        return zstandard.ZstdDecompressor().decompress(payload, max_output_size=size)
    if algo == b"DFLT":
        import zlib

        return zlib.decompress(payload)
    raise ValueError(f"unsupported DCX algorithm {algo!r}")


KRAKEN_BLOCK = 0x40000


def kraken_decompress(src: bytes, size: int) -> bytes:
    """Decompress a Kraken stream one 256 KB block at a time.

    The game's blocks all set the "restart decoder" flag, so each block is
    self-contained (it begins with its own literal bytes, like a fresh stream).
    ooz ignores that flag for Kraken and fails on the second block, so each
    block is handed to ooz as its own stream.
    """
    out = bytearray()
    pos = 0
    while len(out) < size:
        block_size = min(KRAKEN_BLOCK, size - len(out))
        b0, b1 = src[pos], src[pos + 1]
        if b0 & 0x0F != 0x0C or b1 & 0x7F != 6:
            raise ValueError(f"bad Kraken block header at {pos}")
        if b1 & 0x80:
            raise ValueError("Kraken checksums are not supported")
        if b0 & 0x40:  # stored uncompressed
            end = pos + 2 + block_size
        else:
            v = int.from_bytes(src[pos + 2 : pos + 5], "big")
            if v & 0x3FFFF == 0x3FFFF:  # memset block
                end = pos + 6
            else:
                end = pos + 5 + (v & 0x3FFFF) + 1
        out += ooz.decompress(src[pos:end], block_size)
        pos = end
    return bytes(out)
