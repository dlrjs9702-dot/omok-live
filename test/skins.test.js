'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { SKINS, TIERS, ACTIVE_FAMILIES, catalogView, skinById, familyOf, badgesOf, avatarLookOf, transformationById } = require('../lib/skins');
const SkinLooks = require('../public/skin-looks');

// v1.7.30 skins: the catalog and looks (unit), then buying / equipping / sharing through the real server.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'skins-test';

test('카탈로그: 티어별 가격·칸이 서버 정의에서만 오고, 오목 2vs2는 오목 스킨을 함께 쓴다', () => {
  // v1.10.35 경제 기준(통합): about a fifth of the old 500,000 / 1,000,000 / 1,500,000 / 3,000,000P
  assert.equal(TIERS.common.price, 100_000);
  assert.equal(TIERS.premium.price, 200_000);
  assert.equal(TIERS.theme.price, 300_000);
  assert.equal(TIERS.legend.price, 600_000);
  const count = tier => SKINS.filter(s => s.tier === tier && s.family === 'omok' && !s.ip).length; // v1.10.74: character skins counted on their own
  assert.deepEqual(['common', 'premium', 'theme', 'legend'].map(count), [15, 6, 3, 3], '새 일반 5 + S1 재질 5(계속 판매) + v1.10.90 일반 5, 고급 3+3, 테마 2+1, 전설 2+1(테마마다 하나)');
  assert.deepEqual(SKINS.filter(s => s.legacy).map(s => s.id).sort(), ['omok_common_amber', 'omok_common_bronze', 'omok_common_jade', 'omok_common_obsidian', 'omok_common_porcelain']);
  assert.equal(SKINS.filter(s => s.tier === 'theme').every(s => s.slot === 'theme'), true);
  assert.equal(SKINS.find(s => s.tier === 'legend').slot, 'piece');
  assert.deepEqual(badgesOf(['omok_l1', 'omok_c1']), [{ family: 'omok', game: '오목', name: '천상 바둑' }]);
  assert.deepEqual(badgesOf(['omok_l1', 'omok_l2']).map(b => b.name), ['천상 바둑', '왕실 기보']);
  // 배경 테마 ↔ 전설 짝(추천 세트): 별빛 천문대 ↔ 천상 바둑, 조선 기원 ↔ 왕실 기보. 짝은 양방향이다.
  const omokView = catalogView().find(f => f.family === 'omok').skins;
  const pairOf = id => omokView.find(s => s.id === id).pair;
  assert.deepEqual(['omok_l1', 'omok_t2', 'omok_l2', 'omok_t1'].map(pairOf), ['omok_t2', 'omok_l1', 'omok_t1', 'omok_l2']);
  assert.ok(SKINS.filter(s => s.tier === 'legend' && s.family !== 'avatar').every(s => s.pair), '모든 게임 전설이 방 테마와 짝');
  for (const skin of SKINS.filter(s => s.family !== 'avatar')) assert.equal(skin.price, TIERS[skin.tier].price);
  // v1.9.2 광장 아바타: 칸(헤어·의상·모자)마다 품목, 가격은 게임 스킨보다 낮고, 전설 배지·짝에는 들어가지 않는다.
  // v1.10.32: + the character skins (2026-10-05 pack) after them, 망토·꼬리·신발·목걸이 칸, the 4-tier prices
  // v1.10.35 경제 기준(통합): one price list for all of them, the older 16 too (일반 50,000 / 고급 100,000 / 희귀 200,000 /
  // 전설 400,000); the older 16 keep their ids
  const avatar = SKINS.filter(s => s.family === 'avatar' && s.slot !== 'transform'); // (v1.10.91: the transformations below)
  assert.deepEqual(['hair', 'outfit', 'hat', 'cape', 'tail', 'shoes', 'necklace'].map(slot => avatar.filter(s => s.slot === slot).length), [17 + 17, 30 + 19 + 12, 27 + 16 + 12, 13 + 8 + 5, 23 + 17 + 7, 23 + 17 + 5, 23 + 18 + 7] /* v1.10.92 + 포차코 의상·머리장식·꼬리·목걸이 */); // v1.10.36: + 할로윈 27; v1.10.74: + 일반 112 + 캐릭터 44
  // v1.10.74: every character skin names its owner and is never common; IP_SKINS=off leaves all 44 out (lib/skins.js)
  const ip = avatar.filter(s => s.ip);
  assert.equal(ip.length, 48); assert.equal(SKINS.filter(s => s.ip).length, 48 + 12 + 33); // (v1.10.92 + 포차코) // 22 character game pairs + 11 themes; v1.10.91 + their 11 transformations
  assert.ok(ip.every(s => ['산리오', 'DC', '마블', '포켓몬'].includes(s.ip) && s.tier !== 'common' && s.id.startsWith('avatar_ip_')));
  // v1.10.91 변신 따로 판매 (사용자 2026-10-18): each of the 21 a `transform` item at its parts' price, out of the shops' catalog
  const tfs = SKINS.filter(s => s.slot === 'transform'); assert.equal(tfs.length, 22);
  for (const tf of tfs) assert.equal(tf.price, Object.values(transformationById(tf.transform).items).reduce((n, id) => n + skinById(id).price, 0));
  assert.ok(!catalogView().some(f => f.skins.some(s => s.slot === 'transform')));
  assert.equal(require('node:child_process').execFileSync(process.execPath, ['-e', "process.stdout.write(String(require('./lib/skins').SKINS.filter(s => s.ip || s.id.startsWith('avatar_ip_')).length))"], { env: { ...process.env, IP_SKINS: 'off' }, cwd: require('node:path').join(__dirname, '..') }).toString(), '0');
  const older = avatar.filter(s => Number(s.id.split('_').pop()) <= ({ hair: 6, outfit: 5, hat: 5 }[s.slot] || 0));
  assert.equal(older.length, 16);
  const PRICE = { common: 50_000, premium: 100_000, rare: 200_000, legend: 400_000 };
  for (const s of older) assert.equal(s.price, PRICE[s.tier], s.id);
  const halloween = avatar.filter(s => Number(s.id.split('_').pop()) > ({ hair: 12, outfit: 15, hat: 12 }[s.slot] || 10));
  assert.equal(halloween.length, 27); // v1.10.36 할로윈 (sold for good), the same price list
  for (const s of halloween) assert.equal(s.price, PRICE[s.tier], s.id);
  assert.deepEqual(['common', 'premium', 'rare', 'legend'].map(t => halloween.filter(s => s.tier === t).length), [5, 15, 5, 2]);
  const fresh = avatar.filter(s => !older.includes(s) && !halloween.includes(s) && !s.id.startsWith('avatar_animal_') && !s.id.startsWith('avatar_x2_') && !s.ip); // v1.10.74 스킨 2배: below
  const animals = avatar.filter(s => s.id.startsWith('avatar_animal_'));
  assert.equal(animals.length, 50);
  for (const s of animals) assert.equal(s.price, ['outfit', 'hat'].includes(s.slot) ? 100000 : 50000);
  assert.equal(fresh.length, 63);
  for (const s of fresh) assert.equal(s.price, PRICE[s.tier], s.id);
  assert.deepEqual(['common', 'premium', 'rare', 'legend'].map(t => fresh.filter(s => s.tier === t).length), [20, 21, 17, 5]);
  for (const s of avatar.filter(x => x.id.startsWith('avatar_x2_') || x.ip)) assert.equal(s.price, PRICE[s.tier], s.id); // v1.10.74: the same prices by tier
  assert.equal(new Set(fresh.map(s => s.name)).size, 63);
  assert.equal(fresh.filter(s => s.tier === 'rare').every(s => s.tierLabel === '희귀'), true);
  assert.deepEqual(badgesOf(avatar.map(s => s.id)), [], '아바타는 프로필 배지가 아니다');
  assert.deepEqual(avatarLookOf({ avatar: { hair: 'avatar_hair_6', outfit: 'avatar_hat_1', title: 'omok_l1' } }), { look: { hair: 'avatar_hair_6' }, title: '천상 바둑' }, '칸이 맞지 않는 품목은 무시');
  assert.equal(avatarLookOf({ avatar: { title: 'omok_c1' } }).title, null, '칭호는 전설만');
  assert.equal(familyOf('omok'), 'omok');
  assert.equal(familyOf('omok2v2'), 'omok');
  assert.equal(familyOf('othello'), 'othello');
  assert.equal(familyOf('rpg'), null, '스킨 대상이 아닌 게임');
  assert.equal(familyOf('cityking'), null);
  assert.equal(skinById('nope'), null);
  assert.deepEqual(catalogView().map(f => f.family), [...Object.keys(ACTIVE_FAMILIES), 'avatar']);
  for (const family of catalogView().filter(f => f.family !== 'avatar')) { // 그림이 있는 게임마다 일반 5·고급 3·방 테마 2·전설 1 (오목만 S1 재질 5종이 더 있다)
    const tiers = tier => family.skins.filter(s => s.tier === tier && !s.ip).length; // v1.10.74: the character skins on top (a character theme without its legend has no pair)
    // v1.8.7 오목 → v1.9.2 모든 게임: 테마마다 짝 전설(전설 2)
    const twoLegends = true; // v1.9.2: every game has two legends, one per room theme
    assert.deepEqual(['premium', 'theme', 'legend'].map(tiers), [6, 3, twoLegends ? 3 : 1], family.family); // v1.10.90 스킨 2배: +3 고급, +1 테마, +1 전설
    if (twoLegends) for (const skin of family.skins.filter(s => (s.tier === 'legend' || s.tier === 'theme') && !s.ip)) assert.ok(skin.pair, `${skin.id} 짝`);
    assert.equal(tiers('common'), family.family === 'omok' ? 15 : 10, family.family); // v1.10.90: +5 일반
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

async function boot(t, extraEnv = {}) {
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
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: PASSWORD, NODE_ENV: 'test', ...extraEnv },
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
    return { label, id: issued.data.key.id, key, session: (await res.text()).match(/data-session="([^"]+)"/)?.[1] };
  }
  const grant = (person, amount) => req(`/api/admin/keys/${person.id}/points`, admin, { requestId: crypto.randomUUID(), category: 'event', amount });
  async function relogin(person) {
    assert.equal((await req('/api/logout', person.session, {})).status, 200);
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: person.key }).toString() });
    return (await res.text()).match(/data-session="([^"]+)"/)?.[1];
  }
  async function plaza(token) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(base + '/api/lobby/events', { headers: { 'X-Session-Token': token }, signal: controller.signal });
      let text = '';
      for await (const chunk of res.body) {
        text += Buffer.from(chunk).toString();
        const snapshot = text.match(/event: plaza\ndata: ([^\n]+)\n\n/);
        if (snapshot) return JSON.parse(snapshot[1]);
      }
      throw new Error('Missing plaza snapshot');
    } finally { clearTimeout(timeout); controller.abort(); }
  }
  return { req, guest, grant, relogin, plaza, logs: () => logs };
}

test('캐릭터 체형 API: 무료 저장·재로그인·전체 파츠 착용·사람형 제한·잘못된 요청 거절', { timeout: 60000 }, async t => {
  const fx = await boot(t);
  const a = await fx.guest('체형선택');
  const body = { characterId: 'kuromi', mode: 'current' };
  assert.equal((await fx.req('/api/avatar/transformation', null, body)).status, 401);
  assert.equal((await fx.req('/api/avatar/transformation', a.session, null)).status, 404, 'null JSON is rejected without a server error');
  assert.equal((await fx.req('/api/avatar/transformation', a.session, { characterId: '__proto__', mode: 'native' })).status, 404);
  assert.equal((await fx.req('/api/avatar/transformation', a.session, { ...body, mode: 'giant' })).status, 400);
  assert.equal((await fx.req('/api/avatar/transformation', a.session, { characterId: 'ironman', mode: 'native' })).status, 400);
  assert.equal((await fx.req('/api/avatar/transformation', a.session, body)).data.error, 'SKIN_NOT_OWNED');
  await fx.grant(a, 3_000_000);
  const character = require('../lib/skins').transformationById('kuromi');
  // v1.10.91 (A안): the parts on are not a transformation; the transformation bought and chosen is
  for (const skinId of Object.values(character.items)) assert.equal((await fx.req('/api/skins/buy', a.session, { skinId })).status, 200);
  for (const skinId of Object.values(character.items)) assert.equal((await fx.req('/api/skins/equip', a.session, { skinId })).status, 200);
  assert.equal((await fx.req('/api/avatar/transformation', a.session, body)).data.error, 'SKIN_NOT_OWNED');
  const tf = require('../lib/skins').transformSkinId('kuromi');
  assert.equal((await fx.req('/api/skins/buy', a.session, { skinId: tf })).status, 200);
  assert.equal((await fx.req('/api/avatar/transformation', a.session, body)).data.error, 'TRANSFORMATION_INCOMPLETE');
  assert.equal((await fx.req('/api/skins/equip', a.session, { skinId: tf })).status, 200);
  const list = (await fx.req('/api/transformations', a.session)).data.list; assert.equal(list.length, 22); assert.deepEqual(list.filter(t => t.owned).map(t => [t.character, t.chosen]), [['kuromi', true]]);
  const balance = (await fx.req('/api/points', a.session)).data.balance;
  const history = (await fx.req('/api/points/history', a.session)).data;
  const pose = await fx.req('/api/plaza/state', a.session, { x: 0, z: 0, yaw: 0, moving: false });
  const changed = await fx.req('/api/avatar/transformation', a.session, { ...body, price: 999999 });
  assert.deepEqual([changed.status, changed.data.avatar.look.transformationModes.kuromi], [200, 'current']);
  assert.equal(changed.data.equipped.avatar.transformation_kuromi, 'current');
  assert.equal((await fx.plaza(a.session)).players.find(p => p.id === pose.data.id).look.transformationModes.kuromi, 'current', '다음 위치 전송 전 광장에도 새 체형 공유');
  assert.equal((await fx.req('/api/points', a.session)).data.balance, balance);
  assert.deepEqual((await fx.req('/api/points/history', a.session)).data, history);
  await fx.req('/api/skins/equip', a.session, { skinId: null, game: 'avatar', slot: 'hat' }); // a part off: still transformed
  assert.equal((await fx.req('/api/avatar/transformation', a.session, { ...body, mode: 'current' })).status, 200);
  await fx.req('/api/skins/equip', a.session, { skinId: null, game: 'avatar', slot: 'transform' }); // the transformation off
  assert.equal((await fx.req('/api/avatar/transformation', a.session, { ...body, mode: 'native' })).status, 409);
  const session = await fx.relogin(a);
  assert.ok(session);
  const restored = await fx.req('/api/skins', session);
  assert.equal(restored.data.avatar.look.transformationModes.kuromi, 'current');
  assert.equal(restored.data.avatar.look.hat, undefined);
  assert.equal((await fx.req('/api/skins/equip', session, { skinId: tf })).status, 200);
  assert.equal((await fx.req('/api/avatar/transformation', session, { ...body, mode: 'native' })).data.avatar.look.transformationModes.kuromi, 'native');
});

test('캐릭터 체형 IP 비활성: API와 공개 외형에서 제외하고 동물은 유지', { timeout: 60000 }, async t => {
  const fx = await boot(t, { IP_SKINS: 'off' });
  const a = await fx.guest('기본동물');
  assert.equal((await fx.req('/api/avatar/transformation', a.session, { characterId: 'kuromi', mode: 'current' })).status, 404);
  assert.equal((await fx.req('/api/avatar/transformation', a.session, { characterId: 'animal-cat', mode: 'current' })).data.error, 'SKIN_NOT_OWNED');
  const { execFileSync } = require('node:child_process');
  const sanitized = JSON.parse(execFileSync(process.execPath, ['-e', "process.stdout.write(JSON.stringify(require('./lib/skins').avatarLookOf({avatar:{transformation_kuromi:'native','transformation_animal-cat':'current',face_eyes:'eyes_heart',dye_base_hair:'c12'}})))"],
    { cwd: path.resolve(__dirname, '..'), env: { ...process.env, IP_SKINS: 'off' } }).toString());
  assert.deepEqual(sanitized.look.transformationModes, { 'animal-cat': 'current' });
  assert.deepEqual(sanitized.look.face, { eyes: 'heart' });
  assert.equal(typeof sanitized.look.hairColor, 'string');
});

test('스킨 구매·장착: 부족하면 거절, 1회만 결제, 미보유 장착 거절, 방의 모두에게 같은 스킨이 보인다', { timeout: 60000 }, async t => {
  const fx = await boot(t);
  const a = await fx.guest('구매자');
  const b = await fx.guest('상대');
  const skin = 'omok_p1'; // 고급 200,000P (v1.10.35)

  const shop = await fx.req('/api/skins', a.session);
  assert.equal(shop.status, 200);
  assert.equal(shop.data.catalog.find(f => f.family === 'omok').skins.length, 17 + 3 + 10); // v1.10.74: + 헬로키티·슈퍼맨 말, 헬로키티 테마; v1.10.90 스킨 2배 +10
  assert.deepEqual(shop.data.owned, []);
  assert.equal((await fx.req('/api/skins', null)).status, 401, '세션 없이는 불가');

  const poor = await fx.req('/api/skins/buy', a.session, { skinId: skin });
  assert.equal(poor.status, 409, '100,000P로는 200,000P 스킨을 못 삼');
  assert.equal(poor.data.error, 'INSUFFICIENT_POINTS');
  assert.equal((await fx.req('/api/points', a.session)).data.balance, 100_000, '실패는 차감 없음');
  assert.equal((await fx.req('/api/skins/buy', a.session, { skinId: 'nope' })).status, 404);
  assert.equal((await fx.req('/api/skins/equip', a.session, { skinId: skin })).status, 409, '사지 않은 스킨은 장착 불가');

  assert.equal((await fx.grant(a, 200_000)).status, 200);
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

  // v1.9.2 광장 아바타·칭호: 아바타 품목은 같은 구매·장착 흐름, 칭호는 보유한 전설만.
  assert.equal((await fx.grant(a, 3_500_000)).status, 200);
  assert.equal((await fx.req('/api/skins/buy', a.session, { skinId: 'avatar_hat_4' })).status, 200);
  const worn = await fx.req('/api/skins/equip', a.session, { skinId: 'avatar_hat_4' });
  assert.deepEqual(worn.data.avatar, { look: { hat: 'avatar_hat_4' }, title: null });
  assert.equal((await fx.req('/api/skins/title', a.session, { skinId: 'omok_l1' })).status, 409, '사지 않은 전설은 칭호 불가');
  assert.equal((await fx.req('/api/skins/title', a.session, { skinId: 'avatar_hat_4' })).status, 404, '아바타 품목은 칭호가 아님');
  assert.equal((await fx.req('/api/skins/buy', a.session, { skinId: 'omok_l1' })).status, 200);
  const titled = await fx.req('/api/skins/title', a.session, { skinId: 'omok_l1' });
  assert.deepEqual([titled.status, titled.data.avatar.title], [200, '천상 바둑']);
  assert.equal((await fx.req('/api/skins', a.session)).data.avatar.title, '천상 바둑');
  assert.equal((await fx.req('/api/skins/title', a.session, { skinId: null })).data.avatar.title, null);
});

// v1.9.3 광장 V3: 위치는 로비에서만 받고, 숫자만 받아 광장 범위로 자르며, 이름·모습은 서버가 정한다.
test('광장 위치: 세션 필요, 범위 밖 숫자는 잘리고, 방 안에서는 거절, 나가면 빠진다', { timeout: 60000 }, async t => {
  const fx = await boot(t);
  const a = await fx.guest('걷는사람');
  assert.equal((await fx.req('/api/plaza/state', null, { x: 1, z: 1 })).status, 401);
  const sent = await fx.req('/api/plaza/state', a.session, { x: 999, z: -999, yaw: 'nope', moving: 'yes', name: '사칭', look: { hair: 'avatar_hair_6' } });
  assert.equal(sent.status, 200);
  assert.match(sent.data.id, /^[0-9a-f-]{8}$/);
  assert.equal((await fx.req('/api/plaza/leave', a.session, {})).status, 200);
  const room = await fx.req('/api/rooms', a.session, { gameType: 'omok' });
  assert.equal(room.status, 201);
  assert.equal((await fx.req('/api/plaza/state', a.session, { x: 0, z: 0 })).status, 409, '방 안에서는 광장 위치를 보내지 않는다');
});
