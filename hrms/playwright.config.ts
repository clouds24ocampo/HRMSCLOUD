import "dotenv/config";
import { defineConfig } from "@playwright/test";

// PW_PORT lets the tests run against a second server (for example `next start` of the production build) while `npm run dev` keeps running.
const port = process.env.PW_PORT ?? "3300";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: `http://localhost:${port}` },
  webServer: { command: `next dev -H 0.0.0.0 -p ${port}`, url: `http://localhost:${port}/login`, reuseExistingServer: true, timeout: 120_000, env: { ALLOW_MULTIPLE_ORGS: "true" } },
});
