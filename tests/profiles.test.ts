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
import {
  initialDocuments,
  upgradeDocument,
  validDocument,
} from "../src/storage/schema";

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

describe("routing rules", () => {
  const player = initialDocuments().player;
  const withRules = (rules: unknown) => ({
    ...player,
    profiles: [{ ...player.profiles[0], rules }],
  });

  it("accepts known path types once each", () => {
    expect(
      validDocument("player", withRules({ avoid: ["torrent"], dlc: false })),
    ).toBe(true);
    expect(
      validDocument("player", withRules({ avoid: ["teleport"], dlc: true })),
    ).toBe(false);
    expect(
      validDocument(
        "player",
        withRules({ avoid: ["torrent", "torrent"], dlc: true }),
      ),
    ).toBe(false);
  });

  it("gives version 5 profiles the default rules", () => {
    const profile: Record<string, unknown> = { ...player.profiles[0] };
    delete profile.rules;
    expect(
      upgradeDocument("player", {
        ...player,
        schemaVersion: 5,
        profiles: [profile],
      }),
    ).toEqual(player);
  });
});

describe("the shared grace filter", () => {
  it("defaults off and upgrades a version 7 file without changing profiles or other settings", () => {
    const player = addProfile(initialDocuments().player);
    player.language = "zh-TW";
    player.stepSize = "large";
    player.profiles[0].progress.position = "grace/1";
    expect(player.hideUnusedGraces).toBe(false);
    const legacy: Record<string, unknown> = { ...player, schemaVersion: 7 };
    delete legacy.hideUnusedGraces;
    expect(upgradeDocument("player", legacy)).toEqual(player);
    expect(validDocument("player", legacy)).toBe(false);
    expect(
      validDocument("player", { ...player, hideUnusedGraces: "yes" }),
    ).toBe(false);
  });

  it("saves and reloads the setting once for every playthrough", async () => {
    const directory = await mkdtemp(join(tmpdir(), "route-of-grace filter "));
    try {
      const store = new FileStore(resolveStoragePaths(directory));
      const player = {
        ...addProfile(initialDocuments().player),
        hideUnusedGraces: true,
      };
      await store.write("player", player, null);
      const reopened = await store.read("player");
      expect(reopened.state).toEqual(player);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
