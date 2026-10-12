// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore, StorageError } from "../server/store";
import { resolveStoragePaths } from "../server/paths";
import { initialDocuments } from "../src/storage/schema";

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "route-of-grace storage "));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
const store = () => new FileStore(resolveStoragePaths(directory));

describe("file store", () => {
  it("keeps each document in its own file, under the new app's names", async () => {
    expect(() => resolveStoragePaths("relative")).toThrow(
      "ROUTE_OF_GRACE_DATA_DIR",
    );
    const { map, player } = initialDocuments();
    const saved = await store().write("map", map, null);
    await store().write("player", player, null);
    expect(
      JSON.parse(await readFile(join(directory, "map.json"), "utf8")),
    ).toEqual(map);
    expect(
      JSON.parse(await readFile(join(directory, "player.json"), "utf8")),
    ).toEqual(player);
    expect(await store().read("map")).toEqual({
      state: map,
      revision: saved.revision,
    });
  });

  it("refuses stale revisions and invalid documents", async () => {
    const { map } = initialDocuments();
    const first = await store().write("map", map, null);
    await store().write(
      "map",
      { ...map, nodes: [], edges: [] },
      first.revision,
    );
    await expect(store().write("map", map, null)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      store().write("map", { ...map, schemaVersion: 2 }, first.revision),
    ).rejects.toBeInstanceOf(StorageError);
  });

  it("preserves an unreadable file and hands it back for recovery", async () => {
    await writeFile(join(directory, "map.json"), "{not json");
    await expect(store().read("map")).rejects.toMatchObject({
      status: 422,
      recovery: "{not json",
    });
    expect(await readFile(join(directory, "map.json"), "utf8")).toBe(
      "{not json",
    );
  });
});
