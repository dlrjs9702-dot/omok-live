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
  // v1.10.90: the newer island 3D specs (run in the CI plaza job) left the games shards too (games-2 went past 40 minutes)
  testIgnore: [...(process.env.PLAYWRIGHT_TEST_GROUP?.startsWith('games-') ? ['**/island-assets.spec.js', '**/native-assets.spec.js', '**/plaza.spec.js'] : []),
    ...(process.env.PLAYWRIGHT_TEST_GROUP?.startsWith('games-') || process.env.PLAYWRIGHT_SKIP_ISLAND === '1' ? ['**/river-fishing.spec.js', '**/weed-board.spec.js', '**/island-time.spec.js', '**/island-weather.spec.js', '**/island-stars.spec.js', '**/island-contest.spec.js', '**/island-admin-look.spec.js', '**/island-plants.spec.js', '**/island-together.spec.js', '**/island-guide.spec.js', '**/island-insects.spec.js', '**/island-pets.spec.js', '**/asset-inspector.spec.js', '**/shop-browse.spec.js', '**/title-hall.spec.js', '**/action-lock.spec.js', '**/resident-talk.spec.js', '**/transform-shop.spec.js', '**/general-store.spec.js', '**/mayor-gait.spec.js', '**/island-solids.spec.js', '**/dalmaru-preview.spec.js', '**/dalmaru-walk.spec.js', '**/dress-room.spec.js'] : [])],
  timeout: process.env.CI ? 60_000 : 30_000, // (CI 2차: a test with two or three pages on the software-rendered runner sat at 29-30 s -- the budget, not the waits)
  expect: {
    timeout: process.env.CI ? 15_000 : 5_000, // (CI 2026-10-19: the GitHub runner draws the island at a few frames a second -- a state the page sets a moment later is missed at 5 s)
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // One retry locally too: a test that fails once and passes on the retry is reported as "flaky" (with a trace, see
  // `trace: 'on-first-retry'`), so an occasional infrastructure hiccup is told apart from a real failure, which fails twice.
  retries: 1, // (v1.10.98 CI 단축: 2 → 1 on CI too -- a 3D test is about 3 minutes, so a real failure cost 9; a flaky one still shows as "flaky")
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
        ISLAND_QUEST_WEEK: '0', // the 정원사·어부 week whatever the date (lib/island-quests.js)
        HOST: '127.0.0.1',
        PORT: String(port),
        ADMIN_PASSWORD: adminPassword,
        DATA_DIR: dataDir,
        DATABASE_URL: '',
      },
    },
  } : {}),
});
