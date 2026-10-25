'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

// v1.10.31 잡초 채집: a weed is pulled in two steps about a second apart, standing by it; one weed goes to one player
// (also when two pull it at once), never twice for a resent finish; the bag stacks to 999; the town hall pays 300P each
// outside the daily limit; what was pulled stays pulled after a restart, and the weeds pulled before a missed midnight
// grow back elsewhere when the server comes back.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'weed-test';

async function boot(t, dir) {
  const port = await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: PASSWORD, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', d => { logs += d; });
  child.stderr.on('data', d => { logs += d; });
  const stop = async () => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 4000).unref(); });
  };
  t.after(stop);
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) {
    try { if ((await fetch(base + '/health')).ok) break; } catch {}
    await sleep(100);
  }
  let ip = 0;
  async function req(route, token, body) {
    const headers = { 'X-Forwarded-For': `10.66.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken;
  assert.ok(admin, logs);
  const issue = async (label) => {
    const issued = await req('/api/admin/keys', admin, { label });
    return { id: issued.data.key.id, key: issued.data.html.match(/name="token" value="([^"]+)"/)[1] };
  };
  const enter = async ({ key }) => {
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: key }).toString() });
    return (await res.text()).match(/data-session="([^"]+)"/)?.[1];
  };
  const release = (session) => req('/api/session/release', session, {});
  return { req, issue, enter, release, stop, logs: () => logs };
}

test('잡초 채집: 시작→1초 뒤 완료, 한 포기 한 명, 재요청 중복 없음, 관공서 300P, 재시작 유지·밀린 자정 보충', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'weed-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  let server = await boot(t, dir);
  const { issue, enter } = server;
  const ka = await issue('뽑는가'); const kb = await issue('뽑는나');
  let sa = await enter(ka); let sb = await enter(kb);
  assert.ok(sa && sb, server.logs());
  const R = () => server.req;
  const weeds = async (s) => (await R()('/api/island/weeds', s)).data;
  const first = await weeds(sa);
  const BASE = require('../lib/island-weeds').BASE.length; // (3회차 8: the tufts where a weed sits, not all 1,400)
  assert.equal(first.weeds.length, BASE);
  const [id, x, z] = first.weeds.find(([, wx, wz]) => Math.hypot(wx, wz) > 30);
  const stand = (s, px, pz) => R()('/api/plaza/state', s, { x: px, z: pz, yaw: 0, moving: false });
  await stand(sa, x + 1, z); await stand(sb, x - 1, z);
  // too soon, not started, too far
  assert.equal((await R()('/api/island/weed/finish', sa, { weedId: id, requestId: crypto.randomUUID() })).data.error, 'WEED_NOT_STARTED');
  assert.equal((await R()('/api/island/weed/start', sa, { weedId: id })).status, 200);
  assert.equal((await R()('/api/island/weed/finish', sa, { weedId: id, requestId: crypto.randomUUID() })).data.error, 'WEED_TOO_SOON');
  // both start; both finish a second later at once: one gets it
  await R()('/api/island/weed/start', sa, { weedId: id }); await R()('/api/island/weed/start', sb, { weedId: id });
  await sleep(1500); // PULL_MS 1.4 s (v1.10.89)
  const ra = crypto.randomUUID();
  const [fa, fb] = await Promise.all([R()('/api/island/weed/finish', sa, { weedId: id, requestId: ra }), R()('/api/island/weed/finish', sb, { weedId: id, requestId: crypto.randomUUID() })]);
  assert.deepEqual([fa.status, fb.status].sort(), [200, 409]);
  const [winner, wid] = fa.status === 200 ? [sa, ra] : [sb, null];
  const again = await R()('/api/island/weed/finish', winner, { weedId: id, requestId: wid || crypto.randomUUID() });
  assert.ok(again.status === 200 || again.status === 409);
  const bagOf = async (s) => ((await R()('/api/island/bag', s)).data.items || []).find((e) => e.itemId === 'weed')?.qty || 0;
  assert.equal(await bagOf(winner), 1, '한 포기는 한 번만');
  assert.ok(!(await weeds(sa)).weeds.some(([w]) => w === id), '모두의 섬에서 사라짐');
  // a far one: too far
  const far = first.weeds.find(([, wx, wz]) => Math.hypot(wx - x, wz - z) > 20);
  assert.equal((await R()('/api/island/weed/start', sa, { weedId: far[0] })).data.error, 'TOO_FAR');
  // the town hall: 300P a weed
  // v1.10.84: at the 민원 창구 inside the hall (in at its door, to the counter)
  const T = require('../public/plaza/island-terrain'); const hallDoor = T.facilityDoor('townhall'); await R()('/api/plaza/leave', winner === sa ? sb : sa, {}); await stand(winner, hallDoor.x, hallDoor.z); // (the other off the island: the way to the hall must not run into them)
  assert.equal((await R()('/api/island/townhall/enter', winner, {})).status, 200);
  const counter = T.roomWorld(T.TOWNHALL_ROOM.desk.lx, T.TOWNHALL_ROOM.desk.lz); await stand(winner, counter.x, counter.z);
  const before = (await R()('/api/donation', winner)).data.balance;
  const sold = await R()('/api/island/sell', winner, { place: 'office', requestId: crypto.randomUUID() });
  const price = require('../lib/island-items').priceOf('weed'); // 300P (900P on a 제초 요청 day: the server's clock)
  assert.equal(sold.status, 200); assert.equal(sold.data.paid, price);
  assert.equal((await R()('/api/donation', winner)).data.balance, before + price);
  // v1.10.90 잡초 게시판: today's pull and hand-in rankings (the winner: 1 and 1), names only; 제초왕 for the week's 1st
  const boardOf = async (s) => (await R()('/api/island/weeds/board', s)).data;
  const board = await boardOf(winner);
  assert.deepEqual([board.today.pulls.total, board.today.submits.total, board.week.total], [1, 1, 1]);
  assert.deepEqual([board.today.pulls.top[0].total, board.today.pulls.top[0].mine, board.today.submits.top[0].rank], [1, true, 1]);
  assert.ok(!JSON.stringify(board).includes('guest:'), '계정 ID 비공개');
  assert.equal(board.island.weeds, BASE - 1); assert.deepEqual(board.merit, []);
  assert.equal((await boardOf(winner === sa ? sb : sa)).today.pulls.me, null);
  assert.equal((await R()('/api/skins/title', winner, { skinId: 'title_weedking' })).status, 409);
  await R()('/api/test/fishking/settle', null, { now: Date.now() + 7 * 24 * 60 * 60 * 1000, asCurrent: true });
  assert.equal((await R()('/api/skins/title', winner, { skinId: 'title_weedking' })).data.avatar.title, '제초왕');
  const hall = (await R()('/api/island/titles', winner)).data.titles.find((x) => x.id === 'weedking');
  assert.deepEqual([hall.name, hall.entries.length, hall.entries[0].mine], ['제초왕', 1, true]);
  // 5회차 B2 7: and stands in 영웅마루 (the plaza's statue list), in their look, with the week on its plaque
  const kings = (await R()('/api/donation', winner)).data.statues.filter((s) => s.king);
  assert.deepEqual(kings.map((s) => [s.king, s.name, Boolean(s.look), /^\d{4}-\d\d-\d\d$/.test(s.week)]), [['weedking', winner === sa ? '뽑는가' : '뽑는나', true, true]]);
  // a restart: the pulled weed stays pulled; then a midnight passed while the server was off: it grows back somewhere new
  await server.stop();
  const file = path.join(dir, 'points.json');
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(data.island.weeds.pulled, 1);
  data.island.weeds.day = '2000-01-01'; await fs.writeFile(file, JSON.stringify(data));
  server = await boot(t, dir);
  sa = await server.enter(ka);
  const after = await weeds(sa);
  // v1.10.90 / 잡초 2배: 1 pulled the day before (0~279) -> today's total is 3,360; of the 1,961 short of it at most
  // GROW_MAX (700) grow somewhere new tonight, the rest on the nights after
  assert.equal(after.weeds.length, BASE - 1 + 700, '적게 뽑은 다음 날은 3,360포기를 향해 하룻밤 700포기');
  assert.ok(!after.weeds.some(([w]) => w === id));
  assert.equal(after.weeds.filter(([w]) => w.startsWith('g')).length, 700);
});
