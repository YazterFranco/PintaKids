import { defineConfig, devices } from '@playwright/test';

/**
 * E2E de Pintakids contra el servidor real (sin dependencias) en local.
 * Uso: npx playwright test
 */
export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3123',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node --disable-warning=ExperimentalWarning ../server/src/server.ts',
    env: { PORT: '3123', RELEASES_DIR: './.tmp-releases' },
    url: 'http://127.0.0.1:3123/v1/health',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
