'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');

// v1.8.6: the public hwatu pictures are served gzipped with a long cache; only card-shaped names are reachable.
test('공개 화투 그림은 압축·장기 캐시로 내려가고, 카드 이름 형식이 아닌 경로는 열리지 않는다', { timeout: 30_000 }, async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hwatu-serve-'));
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const proc = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: 'hwatu-test', NODE_ENV: 'test' }, stdio: 'ignore' });
  t.after(async () => { proc.kill('SIGTERM'); await new Promise(resolve => proc.once('exit', resolve)); await fs.rm(dir, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(`${base}/health`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }

  const raw = await fs.readFile(path.join(__dirname, '..', 'public', 'hwatu', 'm08-gwang.svg'));
  const zipped = await fetch(`${base}/hwatu/m08-gwang.svg`, { headers: { 'Accept-Encoding': 'gzip' } });
  assert.equal(zipped.status, 200);
  assert.equal(zipped.headers.get('content-type'), 'image/svg+xml');
  assert.match(zipped.headers.get('cache-control'), /max-age=604800/);
  assert.equal(Buffer.from(await zipped.arrayBuffer()).length > 0, true); // fetch decodes gzip itself
  const plain = await new Promise((resolve, reject) => require('node:http').get(`${base}/hwatu/m08-gwang.svg`, { headers: { 'Accept-Encoding': 'gzip' } }, res => {
    const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ enc: res.headers['content-encoding'], body: Buffer.concat(chunks) })); }).on('error', reject));
  assert.equal(plain.enc, 'gzip');
  assert.ok(plain.body.length < raw.length / 2, '압축되어 원본의 절반 미만');
  assert.deepEqual(zlib.gunzipSync(plain.body), raw);
  for (const bad of ['/hwatu/LICENSE.md', '/hwatu/../server.js', '/hwatu/M08-GWANG.svg', '/hwatu/none.svg']) {
    assert.notEqual((await fetch(base + bad)).status, 200, bad);
  }
});
