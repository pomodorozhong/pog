import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { localServerPlugin } from "./server/plugin.ts";

const gameData = fileURLToPath(new URL("./game-data", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), localServerPlugin(gameData)],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
