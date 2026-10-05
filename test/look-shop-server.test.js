'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

// v1.10.30 성형외과·염색사: a face part (300,000P) or the colour of one owned dyeable item (50,000P, its own colour back
// costs the same) changed per paid request -- refused without charge when short or not allowed, one charge per request
// however often it is sent (also at once), clothes are never dyed, and everyone sees the new look.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'look-test';

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

test('성형외과·염색사: 잔액 부족·잘못된 선택·미보유·의상은 차감 없이 거절, 성공은 요청당 한 번 차감되고 외형에 반영', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'look-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir);
  const { req } = server;
  const sa = await server.enter(await server.issue('외형가'));
  assert.ok(sa, server.logs());
  const balance = async () => (await req('/api/donation', sa)).data.balance;
  const surgery = (part, design, requestId = crypto.randomUUID()) => req('/api/avatar/surgery', sa, { part, design, requestId });
  const dye = (itemId, color, requestId = crypto.randomUUID()) => req('/api/avatar/dye', sa, { itemId, color, requestId });
  const shop = (await req('/api/avatar/look-shop', sa)).data;
  assert.equal(shop.surgeryFee, 300_000); assert.equal(shop.dyeFee, 50_000);
  assert.deepEqual(Object.keys(shop.faceParts), ['eyes', 'nose', 'mouth']);
  for (const part of Object.values(shop.faceParts)) assert.equal(part.designs.length, 10);
  assert.ok(shop.palette.length >= 20 && shop.palette.length <= 28);
  // 100,000P to start: a surgery is refused, nothing taken
  assert.equal((await surgery('eyes', 'heart')).status, 409);
  assert.equal(await balance(), 100_000);
  assert.equal((await req('/api/test/points-credit', sa, { amount: 1_000_000 })).status, 200);
  for (const [part, design] of [['eyes', 'nope'], ['ears', 'oval'], ['nose', '']]) assert.equal((await surgery(part, design)).status, 400, `${part} ${design}`);
  assert.equal(await balance(), 1_100_000);
  // one surgery, sent three times at once with the same request: one charge
  const id = crypto.randomUUID();
  const same = await Promise.all([surgery('eyes', 'heart', id), surgery('eyes', 'heart', id), surgery('eyes', 'heart', id)]);
  for (const r of same) assert.equal(r.status, 200);
  assert.equal(await balance(), 800_000);
  assert.deepEqual(same[0].data.avatar.look.face, { eyes: 'heart' });
  assert.equal((await surgery('mouth', 'cat')).status, 200);
  assert.equal(await balance(), 500_000);
  // dye: only an owned, dyeable item; clothes never
  assert.equal((await dye('avatar_hair_1', 'c12')).status, 409); // not owned
  assert.equal((await req('/api/skins/buy', sa, { skinId: 'avatar_hair_1' })).status, 200);
  assert.equal((await req('/api/skins/buy', sa, { skinId: 'avatar_outfit_2' })).status, 200);
  assert.equal((await req('/api/skins/equip', sa, { skinId: 'avatar_hair_1' })).status, 200);
  const before = await balance();
  assert.equal((await dye('avatar_outfit_2', 'c12')).status, 400); // clothes are not dyed
  assert.equal((await dye('avatar_hair_1', 'c99')).status, 400);
  assert.equal(await balance(), before);
  const dyed = await dye('avatar_hair_1', 'c12');
  assert.equal(dyed.status, 200);
  assert.equal(await balance(), before - 50_000);
  assert.deepEqual(dyed.data.avatar.look.dye, { avatar_hair_1: '#eda3b8' });
  const back = await dye('avatar_hair_1', null); // its own colour back: the same price
  assert.equal(back.status, 200);
  assert.equal(await balance(), before - 100_000);
  assert.equal(back.data.avatar.look.dye, undefined);
  // the face stays with the account (the look the plaza shows everyone)
  const skins = (await req('/api/skins', sa)).data;
  assert.deepEqual(skins.avatar.look.face, { eyes: 'heart', mouth: 'cat' });
});
