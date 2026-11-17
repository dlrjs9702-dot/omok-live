'use strict';
// 1.10.349 DB 백업 (notes 178A·179A): /api/admin/backup -- the admin only, every table in, sealed so only the private key opens it,
// six a day; the database path read through a cursor in batches; this PC's fetch.js keeps the day's file and drops the old
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { boot } = require('../test-support/test-server');
const B = require('../lib/db-backup');

const pair = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const read = async (s) => { const parts = []; for await (const c of s) parts.push(c); return Buffer.concat(parts); };

test('DB 백업 봉인: 공개 키로 잠그고 개인 키로만 열림, 한 바이트만 바뀌어도 못 엶, 공개 키는 환경 변수(PEM·base64)나 저장소 파일', async () => {
  const k = pair(); const other = pair();
  const buf = await read(B.stream({ client: fakeClient({ a: [{ id: 1, v: '가' }] }), publicKey: k.publicKey, at: 'T' }));
  assert.ok(buf.subarray(0, 5).equals(B.MAGIC)); assert.ok(!buf.includes(Buffer.from('"가"')), '평문이 보이지 않음');
  const p = B.parse(B.open(buf, k.privateKey)); assert.deepEqual(p.tables, { a: [{ id: 1, v: '가' }] }); assert.equal(p.complete, true);
  assert.throws(() => B.open(buf, other.privateKey), '다른 개인 키');
  const bad = Buffer.from(buf); bad[bad.length - 30] ^= 1; assert.throws(() => B.open(bad, k.privateKey), '바뀐 파일');
  assert.equal(B.publicKeyFrom({ BACKUP_PUBLIC_KEY: k.publicKey }).trim(), k.publicKey.trim());
  assert.equal(B.publicKeyFrom({ BACKUP_PUBLIC_KEY: Buffer.from(k.publicKey).toString('base64') }).trim(), k.publicKey.trim());
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-root-')); rmAtExit(root); assert.equal(B.publicKeyFrom({}, root), null);
  fs.mkdirSync(path.join(root, 'tools', 'backup'), { recursive: true }); fs.writeFileSync(path.join(root, 'tools', 'backup', 'backup-public.pem'), k.publicKey); assert.equal(B.publicKeyFrom({}, root), k.publicKey);
});

// a stand-in for pg's client: the tables' list, a cursor fetched in batches, the snapshot begun and ended
function fakeClient(tables) {
  const log = []; let cur = null;
  return { log, async query(sql) {
    log.push(sql.split(' ')[0]);
    if (sql.includes('information_schema.tables')) return { rows: Object.keys(tables).sort().map((table_name) => ({ table_name })) };
    let m = /DECLARE backup_rows NO SCROLL CURSOR FOR SELECT \* FROM "(.+)"$/.exec(sql); if (m) { cur = { rows: tables[m[1].replace(/""/g, '"')], at: 0 }; return { rows: [] }; }
    m = /^FETCH (\d+) FROM backup_rows$/.exec(sql); if (m) { const got = cur.rows.slice(cur.at, cur.at + Number(m[1])); cur.at += got.length; return { rows: got }; }
    return { rows: [] };
  } };
}
test('DB 백업 DB 경로: 모든 표를 한 스냅샷에서 커서로 500줄씩 -- 1,201줄 표는 세 번, 빈 표도 목록에, 끝 줄에 전체 줄 수', async () => {
  const k = pair(); const big = Array.from({ length: 1201 }, (_, i) => ({ id: i, at: new Date(0).toISOString() }));
  const c = fakeClient({ point_ledger: big, island_bags: [{ user_id: 'u', bag: { items: [] } }], tax_debts: [], 'we"ird': [{ x: 1 }] });
  const p = B.parse(B.open(await read(B.stream({ client: c, publicKey: k.publicKey })), k.privateKey));
  assert.deepEqual(Object.keys(p.tables).sort(), ['island_bags', 'point_ledger', 'tax_debts', 'we"ird']); assert.equal(p.tables.point_ledger.length, 1201); assert.deepEqual(p.tables.tax_debts, []);
  assert.equal(p.rows, 1203); assert.equal(p.complete, true); assert.equal(p.meta.source, 'database');
  assert.equal(c.log.filter((s) => s === 'FETCH').length, 3 + 1 + 1 + 1); assert.equal(c.log[0], 'BEGIN'); assert.equal(c.log.at(-1), 'COMMIT');
});

test('DB 백업 API: 관리자만(손님 403·없음 401), 데이터 폴더 표 모두, 하루 6번 · PC의 fetch.js가 받아 날짜 파일로 두고 30일 지난 것은 지움', async (t) => {
  const k = pair(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-data-')); rmAtExit(dir);
  const server = await boot(t, dir, { BACKUP_PUBLIC_KEY: k.publicKey }); const { req } = server;
  const guest = await server.enter(await server.issue('백업손님'));
  assert.equal((await req('/api/admin/backup', null)).status, 401); assert.equal((await req('/api/admin/backup', guest)).status, 403);
  const res = await fetch(`${server.base}/api/admin/backup`, { headers: { 'X-Session-Token': server.admin } }); assert.equal(res.status, 200);
  const p = B.parse(B.open(Buffer.from(await res.arrayBuffer()), k.privateKey));
  assert.equal(p.complete, true); assert.equal(p.meta.source, 'files');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort(); assert.ok(files.includes('access-keys'), files.join());
  assert.deepEqual(Object.keys(p.tables).sort(), files); assert.ok(JSON.stringify(p.tables['access-keys']).includes('백업손님'), '입장 키 표의 내용까지');
  // this PC's side: the config, the private key, an old file to drop
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-home-')); rmAtExit(home); fs.mkdirSync(path.join(home, 'keys'));
  fs.writeFileSync(path.join(home, 'keys', 'backup-private.pem'), k.privateKey); fs.writeFileSync(path.join(home, '2020-01-01.bak'), 'old');
  fs.writeFileSync(path.join(home, 'config.local.json'), JSON.stringify({ url: server.base, adminPassword: 'look-test' }));
  const run = () => new Promise((resolve) => execFile(process.execPath, [path.join(__dirname, '..', 'tools', 'backup', 'fetch.js')], { env: { ...process.env, BACKUP_DIR: home } }, (error, stdout, stderr) => resolve({ code: error?.code || 0, out: stdout + stderr })));
  const r = await run(); assert.equal(r.code, 0, r.out);
  const day = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  assert.ok(fs.existsSync(path.join(home, `${day}.bak`))); assert.ok(!fs.existsSync(path.join(home, '2020-01-01.bak')), '30일 지난 것 지움');
  assert.match(fs.readFileSync(path.join(home, 'backup.log'), 'utf8'), /ok \d{4}-\d{2}-\d{2}\.bak .*열어 봄: 표 \d+개/);
  // six a day (this test's one, the script's one, four more) -- the seventh refused
  for (let i = 0; i < 4; i += 1) assert.equal((await fetch(`${server.base}/api/admin/backup`, { headers: { 'X-Session-Token': server.admin } }).then(async (x) => { await x.arrayBuffer(); return x.status; })), 200);
  assert.equal((await req('/api/admin/backup', server.admin)).status, 429);
  // a missing password: the script fails and says so in the log
  fs.writeFileSync(path.join(home, 'config.local.json'), JSON.stringify({ url: server.base, adminPassword: '' }));
  const f = await run(); assert.notEqual(f.code, 0); assert.match(fs.readFileSync(path.join(home, 'backup.log'), 'utf8'), /FAILED .*adminPassword/);
  assert.match(server.logs(), /\[backup\] ok bytes=\d+ ms=\d+/); /* (the log: its size and time alone) */
});

test('되살리기 순서 (1.10.353 Codex #7): 외래 키가 가리키는 표 먼저, 자기 참조·고리는 막지 않음', () => {
  const deps = [{ child: 'bank_deposits', parent: 'point_accounts' }, { child: 'point_ledger', parent: 'point_accounts' }, { child: 'tree', parent: 'tree' }, { child: 'a', parent: 'b' }, { child: 'b', parent: 'a' }];
  const order = B.restoreOrder(['bank_deposits', 'point_accounts', 'point_ledger', 'tree', 'a', 'b'], deps);
  assert.ok(order.indexOf('point_accounts') < order.indexOf('bank_deposits'), '계정이 예금보다 먼저');
  assert.ok(order.indexOf('point_accounts') < order.indexOf('point_ledger'));
  assert.deepEqual([...order].sort(), ['a', 'b', 'bank_deposits', 'point_accounts', 'point_ledger', 'tree'], '모두 한 번씩');
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'tools', 'backup', 'restore.js'), 'utf8'), /TRUNCATE \$\{tables\.map\(q\)\.join\(', '\)\}/, '한 번에 비움');
});