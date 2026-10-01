'use strict';
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

async function launch() {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pandemic-followup-'));
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const n = s.address().port; s.close(() => resolve(n)); }); });
  const root = path.resolve(__dirname, '../..');
  const proc = spawn(process.execPath, ['--require', path.join(__dirname, 'pandemic-fixture.cjs'), 'server.js'], {
    cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: '', DATA_DIR: dataDir, HOST: '127.0.0.1', PORT: String(port), ADMIN_PASSWORD: 'playwright-test-password' },
  });
  let output = ''; proc.stdout.on('data', c => { output += c; }); proc.stderr.on('data', c => { output += c; });
  const baseURL = `http://127.0.0.1:${port}`;
  const close = async () => {
    if (proc.exitCode === null) { proc.kill(); await new Promise(resolve => { proc.once('exit', resolve); setTimeout(resolve, 2000).unref(); }); }
    await fs.rm(dataDir, { recursive: true, force: true });
  };
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(baseURL + '/health')).ok) return { baseURL, close }; } catch {}
    if (proc.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await close(); throw new Error(output || 'Pandemic test server failed to start');
}
module.exports = { launch };
