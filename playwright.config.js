const os = require('node:os');
const path = require('node:path');
const { defineConfig, devices } = require('@playwright/test');

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const externalBaseURL = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const managedServer = !externalBaseURL && process.env.PLAYWRIGHT_MANUAL_SERVER !== '1';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
const dataDir = process.env.PLAYWRIGHT_DATA_DIR
  || path.join(os.tmpdir(), `omok-live-playwright-${process.pid}`);

module.exports = defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.js',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 5'] },
    },
  ],
  ...(managedServer ? {
    webServer: {
      command: 'node server.js',
      url: `${baseURL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      gracefulShutdown: {
        signal: 'SIGINT',
        timeout: 5_000,
      },
      env: {
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: String(port),
        ADMIN_PASSWORD: adminPassword,
        DATA_DIR: dataDir,
        DATABASE_URL: '',
      },
    },
  } : {}),
});
