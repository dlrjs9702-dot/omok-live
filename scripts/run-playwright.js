const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL || '';
const baseURL = externalBaseURL || `http://127.0.0.1:${port}`;
const adminPassword = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'playwright-test-password';
const dataDir = process.env.PLAYWRIGHT_DATA_DIR
  || path.join(os.tmpdir(), `omok-live-playwright-${process.pid}`);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isHealthy(url) {
  return new Promise((resolve) => {
    const request = http.get(url, { agent: false }, (response) => {
      response.resume();
      response.once('end', () => resolve(response.statusCode === 200));
    });
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });
}

async function waitForServer(server) {
  const healthURL = `${baseURL}/health`;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`게임 서버가 시작 전에 종료되었습니다. exit code: ${server.exitCode}`);
    if (await isHealthy(healthURL)) return;
    await delay(250);
  }
  throw new Error(`게임 서버가 ${healthURL}에서 준비되지 않았습니다.`);
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  if (process.platform === 'win32') {
    spawnSync(`taskkill /pid ${server.pid} /T /F`, {
      shell: true,
      windowsHide: true,
      stdio: 'ignore',
    });
    return;
  }
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('close', resolve)),
    delay(5000).then(() => server.kill('SIGKILL')),
  ]);
}

async function main() {
  let server;
  let exitCode = 1;
  try {
    if (!externalBaseURL) {
      server = spawn(process.execPath, ['server.js'], {
        cwd: rootDir,
        env: {
          ...process.env,
          NODE_ENV: 'test',
          HOST: '127.0.0.1',
          PORT: String(port),
          ADMIN_PASSWORD: adminPassword,
          DATA_DIR: dataDir,
          DATABASE_URL: '',
        },
        stdio: 'inherit',
        windowsHide: true,
      });
      await waitForServer(server);
    }

    const testProcess = spawn(process.execPath, [
      require.resolve('@playwright/test/cli'),
      'test',
      ...process.argv.slice(2),
    ], {
      cwd: rootDir,
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: baseURL,
        PLAYWRIGHT_ADMIN_PASSWORD: adminPassword,
        PLAYWRIGHT_DATA_DIR: dataDir,
        PLAYWRIGHT_MANUAL_SERVER: '1',
      },
      stdio: 'inherit',
      windowsHide: true,
    });

    exitCode = await new Promise((resolve) => {
      testProcess.once('error', () => resolve(1));
      testProcess.once('exit', (code) => resolve(code ?? 1));
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
  } finally {
    await stopServer(server);
  }
  process.exit(exitCode);
}

main();
