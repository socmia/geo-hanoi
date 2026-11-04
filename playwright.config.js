import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:8080",
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: "python -m http.server 8080",
    url: "http://127.0.0.1:8080",
    reuseExistingServer: true,
    timeout: 15_000,
  },
});
