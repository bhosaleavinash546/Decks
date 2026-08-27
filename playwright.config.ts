import { defineConfig } from '@playwright/test'

// The soak test really does run for ten minutes; give it room.
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 15 * 60 * 1000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5174',
    launchOptions: {
      // Playback must start without a click in the harness.
      args: ['--autoplay-policy=no-user-gesture-required'],
      // Set CHROME_PATH when the local Chromium build does not match the
      // version @playwright/test expects.
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    },
  },
  // Its own port, so a dev server you left running on 5173 is never in the way.
  // vite.config sets strictPort, so a collision would fail hard rather than
  // quietly moving and leaving the tests pointed at nothing.
  webServer: {
    command: 'npm run dev -- --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
