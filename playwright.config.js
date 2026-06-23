import { defineConfig } from '@playwright/test';

// E2E tests drive the real app end to end: Lobby -> seeded match -> the
// actual GameBoard UI. Run `npm run test:e2e` (headless, fast) while
// developing logic, or `npm run test:e2e:headed` to watch real browser
// windows play out the same scripted scenario — handy while writing or
// debugging a test, since this layer (unlike the headless boardgame.io
// integration tests in src/game/) actually renders the board.
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false,
  webServer: [
    {
      command: 'npm run server',
      port: 8000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
  },
});
