import "dotenv/config";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3300" },
  webServer: { command: "npm run dev:next", url: "http://localhost:3300/login", reuseExistingServer: true, timeout: 120_000 },
});
