// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore, StorageError } from "../server/store";
import { resolveStoragePaths } from "../server/paths";
import {
  documentNameOf,
  initialDocuments,
  mapKey,
} from "../src/storage/schema";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "route-of-grace storage "));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
const store = () => new FileStore(resolveStoragePaths(directory));
const MAP = mapKey("profile-2");

describe("file store", () => {
  it("keeps each document in its own file, one map per profile", async () => {
    expect(() => resolveStoragePaths("relative")).toThrow(
      "ROUTE_OF_GRACE_DATA_DIR",
    );
    const { map, player } = initialDocuments();
    const saved = await store().write(MAP, map, null);
    await store().write("player", player, null);
    expect(
      JSON.parse(
        await readFile(join(directory, "maps", "profile-2.json"), "utf8"),
      ),
    ).toEqual(map);
    expect(
      JSON.parse(await readFile(join(directory, "player.json"), "utf8")),
    ).toEqual(player);
    expect(await store().read(MAP)).toEqual({
      state: map,
      revision: saved.revision,
    });
  });

  it("refuses stale revisions and invalid documents", async () => {
    const { map } = initialDocuments();
    const first = await store().write(MAP, map, null);
    await store().write(MAP, { ...map, nodes: [], edges: [] }, first.revision);
    await expect(store().write(MAP, map, null)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      store().write(MAP, { ...map, schemaVersion: 2 }, first.revision),
    ).rejects.toBeInstanceOf(StorageError);
  });

  it("preserves an unreadable file and hands it back for recovery", async () => {
    await mkdir(join(directory, "maps"));
    await writeFile(join(directory, "maps", "profile-2.json"), "{not json");
    await expect(store().read(MAP)).rejects.toMatchObject({
      status: 422,
      recovery: "{not json",
    });
    expect(
      await readFile(join(directory, "maps", "profile-2.json"), "utf8"),
    ).toBe("{not json");
  });

  it("accepts only player and profile map keys", async () => {
    expect(documentNameOf("player")).toBe("player");
    expect(documentNameOf("maps/profile-1a2b3c4d")).toBe("map");
    for (const key of ["map", "maps/../player", "maps/A", "maps/", "x"])
      expect(documentNameOf(key)).toBeNull();
    await expect(store().read("maps/../player" as never)).rejects.toMatchObject(
      { status: 404 },
    );
  });

  it("makes the old shared map the first profile's map", async () => {
    const { map } = initialDocuments();
    const old = { ...map, nodes: [] };
    await writeFile(join(directory, "map.json"), JSON.stringify(old));
    const first = await store().read(mapKey("profile-1"));
    expect(first.state).toEqual(old);
    await expect(access(join(directory, "map.json"))).rejects.toThrow();
    expect(await store().read(mapKey("profile-1"))).toEqual(first);
    // A new profile starts with no map.
    expect(await store().read(MAP)).toEqual({ state: null, revision: null });
  });

  it("moves a deleted profile's map to the deleted folder", async () => {
    const { map, player } = initialDocuments();
    const two = {
      ...player,
      profiles: [
        ...player.profiles,
        { id: "profile-2", name: "", goal: "", constraints: "" },
      ],
    };
    const saved = await store().write("player", two, null);
    await store().write(MAP, map, null);
    await store().write("player", player, saved.revision);
    expect(await store().read(MAP)).toEqual({ state: null, revision: null });
    expect(
      JSON.parse(
        await readFile(
          join(directory, "deleted", "maps", "profile-2.json"),
          "utf8",
        ),
      ),
    ).toEqual(map);
  });
});
