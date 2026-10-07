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
  // Keep the expensive 3D suites in independent CI jobs; the two general shards exclude both.
  testIgnore: process.env.PLAYWRIGHT_TEST_GROUP?.startsWith('games-') ? ['**/island-assets.spec.js', '**/plaza.spec.js'] : [],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // One retry locally too: a test that fails once and passes on the retry is reported as "flaky" (with a trace, see
  // `trace: 'on-first-retry'`), so an occasional infrastructure hiccup is told apart from a real failure, which fails twice.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    // v1.9.7: 일반 사용자는 기존 로비로 전환할 수 없다. 오래된 e2e만 webdriver 전용 내부 플래그로
    // 기존 DOM을 사용하고, plaza.spec은 그 플래그를 지운 뒤 실제 게임 아일랜드를 검증한다.
    storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'gc.testClassic', value: '1' }] }] },
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
