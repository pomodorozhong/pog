import { test as base, expect } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { initialDocuments } from "../../src/storage/schema.ts";

const gameData = join(import.meta.dirname, "../../game-data/catalog.json");

type Fixtures = {
  /** The disposable folder both servers save into. */
  dataDirectory: string;
  /** Reads a saved document, such as `player` or `maps/<profile id>`; null until it is saved. */
  saved(key: string): Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
};

export const test = base.extend<Fixtures>({
  dataDirectory: [
    async ({}, use, info) => {
      test.skip(
        !existsSync(gameData),
        "Game data is missing: run `npm run extract` first.",
      );
      const directory = info.config.metadata.dataDirectory as string;
      // Each test starts fresh. The import from the game's save is off, so a
      // save on this computer never changes what the test sees.
      await rm(directory, { recursive: true, force: true });
      await mkdir(directory, { recursive: true });
      const { player } = initialDocuments();
      await writeFile(
        join(directory, "player.json"),
        JSON.stringify({ ...player, autoImport: false }),
      );
      await use(directory);
    },
    { auto: true },
  ],
  saved: async ({ dataDirectory }, use) => {
    await use(async (key) => {
      try {
        return JSON.parse(
          await readFile(join(dataDirectory, `${key}.json`), "utf8"),
        );
      } catch {
        return null;
      }
    });
  },
});

export { expect };
