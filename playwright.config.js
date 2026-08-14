import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // This sandbox pre-installs a specific Chromium revision that may not
    // match what @playwright/test's version expects by default; point at
    // it explicitly. Harmless in CI, where `playwright install` fetches
    // the matching revision and this path simply won't exist/be used.
    launchOptions: {
      ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
        : {}),
      // Without an explicit proxy, this sandbox silently drops (rather than
      // rejects) outbound connections to hosts like the placeholder
      // Supabase URL used in tests — Chromium then hangs on connect until
      // the test times out instead of failing fast. Routing through the
      // sandbox's own egress proxy turns that into an immediate 403,
      // matching what the app's error handling already expects. No-op in
      // CI/real environments where this proxy doesn't exist.
      ...(process.env.PLAYWRIGHT_CHROMIUM_PROXY
        ? { args: [`--proxy-server=${process.env.PLAYWRIGHT_CHROMIUM_PROXY}`] }
        : {}),
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SUPABASE_URL: 'https://placeholder.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'placeholder-anon-key',
      VITE_DEMO_MODE: 'true',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
