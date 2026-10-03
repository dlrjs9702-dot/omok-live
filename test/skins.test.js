'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { SKINS, TIERS, ACTIVE_FAMILIES, catalogView, skinById, familyOf, badgesOf } = require('../lib/skins');
const SkinLooks = require('../public/skin-looks');

// v1.7.30 skins: the catalog and looks (unit), then buying / equipping / sharing through the real server.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'skins-test';

test('카탈로그: 티어별 가격·칸이 서버 정의에서만 오고, 오목 2vs2는 오목 스킨을 함께 쓴다', () => {
  assert.equal(TIERS.common.price, 500_000);
  assert.equal(TIERS.premium.price, 1_000_000);
  assert.equal(TIERS.theme.price, 1_500_000);
  assert.equal(TIERS.legend.price, 3_000_000);
  const count = tier => SKINS.filter(s => s.tier === tier && s.family === 'omok').length;
  assert.deepEqual(['common', 'premium', 'theme', 'legend'].map(count), [10, 3, 2, 2], '새 일반 5 + S1 재질 5(계속 판매), 고급 3, 테마 2, 전설 2(테마마다 하나)');
  assert.deepEqual(SKINS.filter(s => s.legacy).map(s => s.id).sort(), ['omok_common_amber', 'omok_common_bronze', 'omok_common_jade', 'omok_common_obsidian', 'omok_common_porcelain']);
  assert.equal(SKINS.filter(s => s.tier === 'theme').every(s => s.slot === 'theme'), true);
  assert.equal(SKINS.find(s => s.tier === 'legend').slot, 'piece');
  assert.deepEqual(badgesOf(['omok_l1', 'omok_c1']), [{ family: 'omok', game: '오목', name: '천상 바둑' }]);
  assert.deepEqual(badgesOf(['omok_l1', 'omok_l2']).map(b => b.name), ['천상 바둑', '왕실 기보']);
  // 배경 테마 ↔ 전설 짝(추천 세트): 별빛 천문대 ↔ 천상 바둑, 조선 기원 ↔ 왕실 기보. 짝은 양방향이다.
  const omokView = catalogView().find(f => f.family === 'omok').skins;
  const pairOf = id => omokView.find(s => s.id === id).pair;
  assert.deepEqual(['omok_l1', 'omok_t2', 'omok_l2', 'omok_t1'].map(pairOf), ['omok_t2', 'omok_l1', 'omok_t1', 'omok_l2']);
  assert.ok(SKINS.filter(s => s.tier === 'legend').every(s => s.pair), '모든 전설이 방 테마와 짝');
  for (const skin of SKINS) assert.equal(skin.price, TIERS[skin.tier].price);
  assert.equal(familyOf('omok'), 'omok');
  assert.equal(familyOf('omok2v2'), 'omok');
  assert.equal(familyOf('othello'), 'othello');
  assert.equal(familyOf('rpg'), null, '스킨 대상이 아닌 게임');
  assert.equal(familyOf('cityking'), null);
  assert.equal(skinById('nope'), null);
  assert.deepEqual(catalogView().map(f => f.family), Object.keys(ACTIVE_FAMILIES));
  for (const family of catalogView()) { // 그림이 있는 게임마다 일반 5·고급 3·방 테마 2·전설 1 (오목만 S1 재질 5종이 더 있다)
    const tiers = tier => family.skins.filter(s => s.tier === tier).length;
    // v1.8.7 오목 → v1.9.2 모든 게임: 테마마다 짝 전설(전설 2)
    const twoLegends = true; // v1.9.2: every game has two legends, one per room theme
    assert.deepEqual(['premium', 'theme', 'legend'].map(tiers), [3, 2, twoLegends ? 2 : 1], family.family);
    if (twoLegends) for (const skin of family.skins.filter(s => s.tier === 'legend' || s.tier === 'theme')) assert.ok(skin.pair, `${skin.id} 짝`);
    assert.equal(tiers('common'), family.family === 'omok' ? 10 : 5, family.family);
  }
});

// Relative luminance (sRGB) of the gradient's body color: a skin's black and white stone must stay far apart.
const lum = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4));
  return .2126 * r + .7152 * g + .0722 * b;
};
test('스킨 모양: 모든 스킨에서 흑·백 돌의 명도 차이가 충분하고, 없는 스킨은 기본 돌로 그린다', () => {
  for (const skin of SKINS.filter(s => s.legacy)) { // S1 material skins are plain gradients; the drawn skins are measured in tests/e2e/skins.spec.js
    const black = SkinLooks.look(skin.id, 'black');
    const white = SkinLooks.look(skin.id, 'white');
    const ratio = (lum(white.stops[1]) + .05) / (lum(black.stops[1]) + .05);
    assert.ok(ratio >= 4, `${skin.id} 흑백 대비 ${ratio.toFixed(1)}:1`);
    assert.ok(lum(black.stops[1]) < .2 && lum(white.stops[1]) > .5, `${skin.id} 흑은 어둡고 백은 밝아야 함`);
  }
  assert.equal(SkinLooks.look('nope', 'black'), SkinLooks.CLASSIC.black);
  assert.equal(SkinLooks.look(null, 'white'), SkinLooks.CLASSIC.white);
});

async function boot(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'skins-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
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
  t.after(async () => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 2000).unref(); });
  });
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) {
    try { if ((await fetch(base + '/health')).ok) break; } catch {}
    await sleep(100);
  }
  let ip = 0;
  async function req(route, token, body, method = body === undefined ? 'GET' : 'POST') {
    const headers = { 'X-Forwarded-For': `10.88.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken;
  assert.ok(admin, logs);
  async function guest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    const key = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: key }).toString() });
    return { label, id: issued.data.key.id, session: (await res.text()).match(/data-session="([^"]+)"/)?.[1] };
  }
  const grant = (person, amount) => req(`/api/admin/keys/${person.id}/points`, admin, { requestId: crypto.randomUUID(), category: 'event', amount });
  return { req, guest, grant, logs: () => logs };
}

test('스킨 구매·장착: 부족하면 거절, 1회만 결제, 미보유 장착 거절, 방의 모두에게 같은 스킨이 보인다', { timeout: 60000 }, async t => {
  const fx = await boot(t);
  const a = await fx.guest('구매자');
  const b = await fx.guest('상대');
  const skin = 'omok_common_jade';

  const shop = await fx.req('/api/skins', a.session);
  assert.equal(shop.status, 200);
  assert.equal(shop.data.catalog.find(f => f.family === 'omok').skins.length, 17);
  assert.deepEqual(shop.data.owned, []);
  assert.equal((await fx.req('/api/skins', null)).status, 401, '세션 없이는 불가');

  const poor = await fx.req('/api/skins/buy', a.session, { skinId: skin });
  assert.equal(poor.status, 409, '100,000P로는 500,000P 스킨을 못 삼');
  assert.equal(poor.data.error, 'INSUFFICIENT_POINTS');
  assert.equal((await fx.req('/api/points', a.session)).data.balance, 100_000, '실패는 차감 없음');
  assert.equal((await fx.req('/api/skins/buy', a.session, { skinId: 'nope' })).status, 404);
  assert.equal((await fx.req('/api/skins/equip', a.session, { skinId: skin })).status, 409, '사지 않은 스킨은 장착 불가');

  assert.equal((await fx.grant(a, 500_000)).status, 200);
  const bought = await fx.req('/api/skins/buy', a.session, { skinId: skin, price: 1 }); // a client-sent price is ignored
  assert.deepEqual([bought.status, bought.data.purchased, bought.data.balance], [200, true, 100_000]);
  const again = await Promise.all([1, 2, 3].map(() => fx.req('/api/skins/buy', a.session, { skinId: skin })));
  assert.ok(again.every(r => r.status === 200 && r.data.purchased === false && r.data.owned === true), '이미 산 스킨은 다시 결제되지 않음');
  assert.equal((await fx.req('/api/points', a.session)).data.balance, 100_000);
  const history = (await fx.req('/api/points/history', a.session)).data;
  assert.equal(JSON.stringify(history).split('skin_purchase').length - 1, 1, '원장에 구매 1건');

  const equip = await fx.req('/api/skins/equip', a.session, { skinId: skin });
  assert.deepEqual([equip.status, equip.data.equipped], [200, { omok: { piece: skin } }]);
  assert.deepEqual((await fx.req('/api/skins', a.session)).data.owned, [skin]);

  // The room state shares the equipped skin with everyone, including the opponent's view.
  const created = await fx.req('/api/rooms', a.session, { gameType: 'omok' });
  const code = created.data.state.me.roomCode;
  assert.equal((await fx.req('/api/rooms/join', b.session, { code })).status, 200);
  await fx.req('/api/room/choose-role', a.session, { choice: 'black' });
  await fx.req('/api/room/choose-role', b.session, { choice: 'white' });
  const seenByB = (await fx.req('/api/room', b.session)).data.state;
  assert.equal(seenByB.players.black.skin, skin);
  assert.equal(seenByB.players.white.skin, undefined, '스킨이 없는 사람은 필드 없음(기본 돌)');

  // Taking it off, and other accounts never see someone else's purchase as their own.
  assert.equal((await fx.req('/api/skins/equip', a.session, { skinId: null, game: 'omok', slot: 'piece' })).status, 200);
  assert.equal((await fx.req('/api/room', b.session)).data.state.players.black.skin, undefined);
  assert.deepEqual((await fx.req('/api/skins', b.session)).data.owned, []);
  assert.equal((await fx.req('/api/skins/equip', b.session, { skinId: skin })).status, 409);
});
