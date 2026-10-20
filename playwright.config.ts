import { defineConfig } from "@playwright/test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

// Both servers save into one disposable folder, never the player's own data.
const dataDirectory = (process.env.POG_E2E_DATA_DIR ??= mkdtempSync(
  join(tmpdir(), "pog-e2e-"),
));
if (
  dirname(dataDirectory) !== tmpdir() ||
  !basename(dataDirectory).startsWith("pog-e2e-")
)
  throw new Error(
    "E2E data must be a disposable pog-e2e- folder in the system temporary folder.",
  );
const env = { POG_DATA_DIR: dataDirectory };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  metadata: { dataDirectory },
  globalTeardown: "./tests/e2e/teardown.ts",
  use: {
    baseURL: "http://127.0.0.1:5198",
    headless: true,
    viewport: { width: 1600, height: 1000 },
  },
  webServer: [
    {
      command: "npm run dev -- --port 5198 --strictPort",
      url: "http://127.0.0.1:5198",
      reuseExistingServer: false,
      env,
    },
    {
      command: "npm run build && npm run preview -- --port 5199 --strictPort",
      url: "http://127.0.0.1:5199",
      reuseExistingServer: false,
      env,
      timeout: 180_000,
    },
  ],
  reporter: "list",
});
