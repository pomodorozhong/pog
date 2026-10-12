// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileStore } from "../server/store";
import { resolveStoragePaths } from "../server/paths";
import {
  activeProfile,
  addProfile,
  removeProfile,
  updateProfile,
} from "../src/profiles/profiles";
import { initialDocuments, validDocument } from "../src/storage/schema";

describe("playthrough profiles", () => {
  it("adds, edits and removes profiles, always keeping one active", () => {
    const start = initialDocuments().player;
    const added = addProfile(start);
    const second = activeProfile(added);
    expect(added.profiles).toHaveLength(2);
    expect(second.id).not.toBe(start.activeProfile);

    const named = updateProfile(added, second.id, { goal: "Beat Malenia" });
    expect(activeProfile(named).goal).toBe("Beat Malenia");
    expect(validDocument("player", named)).toBe(true);

    const removed = removeProfile(named, second.id);
    expect(removed.profiles).toEqual(start.profiles);
    expect(removed.activeProfile).toBe(start.activeProfile);
    expect(removeProfile(removed, start.activeProfile)).toBe(removed);
  });

  it("upgrades a version 1 player file into one untitled playthrough", async () => {
    const directory = await mkdtemp(join(tmpdir(), "route-of-grace profiles "));
    try {
      const view = { layer: "overworld", x: 3968, y: 7542, zoom: 5 };
      await writeFile(
        join(directory, "player.json"),
        JSON.stringify({ schemaVersion: 1, language: "zh-TW", view }),
      );
      const store = new FileStore(resolveStoragePaths(directory));
      const { state, revision } = await store.read("player");
      expect(state).toEqual({
        ...initialDocuments().player,
        language: "zh-TW",
        view,
      });
      // The upgraded state saves over the old file with the old file's revision.
      await expect(store.write("player", state, revision)).resolves.toEqual({
        revision: expect.any(String),
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
