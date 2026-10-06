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
  const release = (session) => req('/api/session/release', null, { sessionToken: session });
  return { req, issue, enter, release, stop, base, logs: () => logs };
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

// v1.10.32 캐릭터 스킨 상품화: a new character skin is bought once at its tier's price (a second buy charges nothing),
// worn and taken off for free in its own slot -- the five accessory slots at once -- kept with the account (a new
// session has it), dyed like the other dyeable items (an outfit never), and shown to everyone in the plaza with the
// lost thing a player carries
test('캐릭터 스킨: 등급 가격 1회 결제·중복 구매 무과금·5칸 동시 장착·해제·재접속 유지·염색·다른 사람에게 보이는 외형과 운반', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wear-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir);
  const { req } = server;
  const keyA = await server.issue('꾸미기');
  let sa = await server.enter(keyA);
  const sb = await server.enter(await server.issue('구경'));
  assert.ok(sa && sb, server.logs());
  const balance = async () => (await req('/api/donation', sa)).data.balance;
  assert.equal((await req('/api/test/points-credit', sa, { amount: 4_000_000 })).status, 200);
  const start = await balance();
  const catalog = (await req('/api/skins', sa)).data.catalog.find((f) => f.family === 'avatar').skins;
  const price = (id) => catalog.find((s) => s.id === id).price;
  const items = { hat: 'avatar_hat_6', cape: 'avatar_cape_7', tail: 'avatar_tail_10', shoes: 'avatar_shoes_2', necklace: 'avatar_necklace_4' };
  assert.deepEqual(Object.values(items).map(price), [100_000, 1_500_000, 300_000, 300_000, 700_000]); // 일반·전설·고급·고급·희귀
  for (const id of Object.values(items)) assert.equal((await req('/api/skins/buy', sa, { skinId: id })).data.purchased, true);
  const spent = 100_000 + 1_500_000 + 300_000 + 300_000 + 700_000;
  assert.equal(await balance(), start - spent);
  const again = await req('/api/skins/buy', sa, { skinId: items.cape }); // already owned: nothing charged
  assert.equal(again.status, 200); assert.equal(again.data.purchased, false);
  assert.equal(await balance(), start - spent);
  assert.equal((await req('/api/skins/equip', sa, { skinId: 'avatar_cape_1' })).status, 409); // not owned: not worn
  for (const id of Object.values(items)) assert.equal((await req('/api/skins/equip', sa, { skinId: id })).status, 200);
  let look = (await req('/api/skins', sa)).data.avatar.look;
  for (const [slot, id] of Object.entries(items)) assert.equal(look[slot], id, slot);
  assert.equal(await balance(), start - spent); // wearing is free
  assert.equal((await req('/api/skins/equip', sa, { skinId: null, game: 'avatar', slot: 'shoes' })).status, 200);
  look = (await req('/api/skins', sa)).data.avatar.look;
  assert.equal(look.shoes, undefined); assert.equal(look.cape, items.cape);
  // dyed: a cape yes (50,000P), an outfit no
  const dyed = await req('/api/avatar/dye', sa, { itemId: items.cape, color: 'c22', requestId: crypto.randomUUID() });
  assert.equal(dyed.status, 200); assert.deepEqual(dyed.data.avatar.look.dye, { [items.cape]: '#34507e' });
  assert.equal((await req('/api/skins/buy', sa, { skinId: 'avatar_outfit_6' })).status, 200);
  assert.equal((await req('/api/avatar/dye', sa, { itemId: 'avatar_outfit_6', color: 'c22', requestId: crypto.randomUUID() })).status, 400);
  assert.equal(await balance(), start - spent - 50_000 - 100_000);
  // a new session of the same account: the same look
  await server.release(sa); await sleep(1500);
  sa = await server.enter(keyA);
  assert.ok(sa, server.logs());
  look = (await req('/api/skins', sa)).data.avatar.look;
  assert.equal(look.cape, items.cape); assert.equal(look.necklace, items.necklace); assert.equal(look.tail, items.tail); assert.equal(look.hat, items.hat);
  assert.deepEqual(look.dye, { [items.cape]: '#34507e' });
  // the plaza: someone else sees the look, and the lost thing carried
  const lost = (await req('/api/test/island/lost', sa, {})).data.event;
  assert.ok(lost);
  assert.equal((await req('/api/plaza/state', sa, { x: lost.x, z: lost.z, yaw: 0 })).status, 200);
  const picked = await req('/api/island/event', sa, { id: lost.id });
  assert.equal(picked.status, 200, JSON.stringify(picked.data)); assert.equal(picked.data.action, 'pickup');
  const state = await req('/api/plaza/state', sa, { x: lost.x + 1, z: lost.z, yaw: 0 });
  assert.ok(state.data.events.some((e) => e.kind === 'carrying' && e.id === lost.id), 'I carry it wherever I am');
  const ctrl = new AbortController(); t.after(() => ctrl.abort());
  const res = await fetch(`${server.base}/api/lobby/events`, { headers: { 'X-Session-Token': sb }, signal: ctrl.signal });
  const reader = res.body.getReader(); let text = '';
  while (!/event: plaza\ndata: [^\n]+\n/.test(text)) { const { value, done } = await reader.read(); if (done) break; text += new TextDecoder().decode(value); }
  const players = JSON.parse(text.match(/event: plaza\ndata: ([^\n]+)\n/)[1]).players;
  const a = players.find((p) => p.look?.cape === items.cape);
  assert.ok(a, 'the other player sees the cape'); assert.equal(a.look.necklace, items.necklace); assert.equal(a.carry, lost.id);
  ctrl.abort();
});
