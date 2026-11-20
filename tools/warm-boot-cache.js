'use strict';
// 385 부팅 무게 2: run by `npm install` (postinstall -- on Render that is the build, before the server starts): the server started in
// BOOT_CACHE_ONLY mode -- it loads as ever up to where the island's scenery and the islanders' walk grid are made, keeps them in
// .cache/boot-cache.json (lib/boot-cache.js) and stops, before any store, port or timer. Never fails the install: any error only means
// the server makes them at its start, as it always did.
const path = require('node:path');
const { spawnSync } = require('node:child_process');
try {
  const t0 = Date.now();
  const env = { ...process.env, BOOT_CACHE_ONLY: '1', ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'boot-cache-only', DATABASE_URL: '' };
  const run = spawnSync(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 600000 });
  const said = `${run.stdout || ''}${run.stderr || ''}`.split('\n').filter((l) => l.includes('[boot-cache]')).join(' ');
  console.log(run.status === 0 ? `[warm-boot-cache] ${said || 'done'} ${Date.now() - t0} ms` : `[warm-boot-cache] skipped: exit ${run.status ?? run.error?.message} ${(run.stderr || '').slice(-300)}`);
} catch (error) {
  console.log(`[warm-boot-cache] skipped: ${error.message}`);
}
