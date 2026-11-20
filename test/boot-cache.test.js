'use strict';
// 385 부팅 무게 2 (lib/boot-cache.js): the island's scenery and the islanders' walk grid kept from one start and read at the next -- the
// same bytes as made afresh; a file from other code, or a broken one, not read (made again)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const BootCache = require('../lib/boot-cache');

const ROOT = path.join(__dirname, '..');
const start = (env) => spawnSync(process.execPath, ['server.js'], { cwd: ROOT, encoding: 'utf8', timeout: 120000,
  env: { ...process.env, ADMIN_PASSWORD: 'boot-cache-test', DATABASE_URL: '', BOOT_CACHE_ONLY: '1', NODE_ENV: 'test', ...env } });

test('385 부팅 캐시: 읽은 시작과 새로 만든 시작이 바이트 단위로 같고, 다른 코드의 파일은 안 읽음', { timeout: 240000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-cache-')); const a = path.join(dir, 'a.json'); const b = path.join(dir, 'b.json'); const c = path.join(dir, 'c.json');
  try {
    const made = start({ DATA_DIR: dir, BOOT_CACHE_OUT: a }); assert.equal(made.status, 0, made.stderr.slice(-500)); assert.match(made.stdout, /\[boot-cache\] written .*\(made\)/);
    const read = start({ DATA_DIR: dir, BOOT_CACHE_READ: '1', BOOT_CACHE_FILE: a, BOOT_CACHE_OUT: b }); assert.equal(read.status, 0, read.stderr.slice(-500)); assert.match(read.stdout, /\(read\)/, '읽음');
    assert.ok(fs.readFileSync(a).equals(fs.readFileSync(b)), '읽어서 쥔 나무·덤불·주민 길 격자 = 새로 만든 것 (바이트 단위)');
    const doc = JSON.parse(fs.readFileSync(a, 'utf8')); assert.equal(doc.key, BootCache.sourceHash()); assert.ok(doc.nature.trees.length > 100 && doc.grid.length > 1000);
    fs.writeFileSync(a, JSON.stringify({ ...doc, key: 'other-code' }));
    const other = start({ DATA_DIR: dir, BOOT_CACHE_READ: '1', BOOT_CACHE_FILE: a, BOOT_CACHE_OUT: c }); assert.match(other.stdout, /\(made\)/, '다른 코드의 파일은 안 읽고 새로 만듦');
    assert.ok(fs.readFileSync(b).equals(fs.readFileSync(c)), '새로 만든 것도 같음');
    fs.writeFileSync(a, '{ broken');
    const broken = start({ DATA_DIR: dir, BOOT_CACHE_READ: '1', BOOT_CACHE_FILE: a, BOOT_CACHE_OUT: c }); assert.equal(broken.status, 0); assert.match(broken.stdout, /\(made\)/, '깨진 파일도 새로 만듦');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('385 부팅 캐시 키: public/plaza·lib·server.js 내용이 바뀌면 키도 바뀜', () => {
  assert.match(BootCache.sourceHash(), /^[0-9a-f]{64}$/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boot-cache-key-'));
  try {
    fs.mkdirSync(path.join(root, 'public', 'plaza', 'sub'), { recursive: true }); fs.mkdirSync(path.join(root, 'lib'));
    fs.writeFileSync(path.join(root, 'public', 'plaza', 'sub', 'a.js'), '1'); fs.writeFileSync(path.join(root, 'lib', 'b.json'), '{}'); fs.writeFileSync(path.join(root, 'server.js'), 's'); fs.writeFileSync(path.join(root, 'lib', 'note.md'), 'x');
    const k = BootCache.sourceHash(root); assert.equal(BootCache.sourceHash(root), k, '같은 코드면 같은 키');
    fs.writeFileSync(path.join(root, 'lib', 'note.md'), 'y'); assert.equal(BootCache.sourceHash(root), k, '.js·.json 아닌 파일은 상관없음');
    for (const [f, v] of [['public/plaza/sub/a.js', '2'], ['lib/b.json', '{"a":1}'], ['server.js', 't']]) {
      const p = path.join(root, ...f.split('/')); const old = fs.readFileSync(p); fs.writeFileSync(p, v); assert.notEqual(BootCache.sourceHash(root), k, `${f} 바뀌면 다른 키`); fs.writeFileSync(p, old);
    }
    fs.writeFileSync(path.join(root, 'lib', 'c.js'), ''); assert.notEqual(BootCache.sourceHash(root), k, '파일이 늘어도 다른 키');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
