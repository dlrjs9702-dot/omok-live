'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { avatarLookOf, transformationById, transformationModeAllowed } = require('../lib/skins');

// Exercise the production route and its real reload helper with a failing storage read after a successful save.
// Keeping the fault in this VM fixture avoids a test-only failure switch in the running server.
const source = fs.readFileSync(require.resolve('../server.js'), 'utf8');
const reloadStart = source.indexOf('async function loadEquippedSkins(account) {');
const reloadEnd = source.indexOf('function equippedSkin(', reloadStart);
const routeStart = source.indexOf("  if (pathname === '/api/avatar/transformation' && req.method === 'POST') {");
const routeEnd = source.indexOf('  // v1.9.2 광장 칭호:', routeStart);
assert.ok(reloadStart >= 0 && reloadEnd > reloadStart && routeStart >= 0 && routeEnd > routeStart);

function fixture({ latest, readError } = {}) {
  const account = 'guest:cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const items = transformationById('kuromi').items;
  const old = { avatar: { ...items, transformation_kuromi: 'native' } };
  const saved = { avatar: { ...items, gender: 'female', face_eyes: 'eyes_heart', transformation_kuromi: 'current' } };
  const equippedSkinCache = new Map([[account, old]]);
  const plazaPresence = new Map([['viewer', { account, name: '입은사람', look: avatarLookOf(old).look, title: null }]]);
  const errors = [];
  let saves = 0; let reads = 0; let broadcasts = 0;
  const context = vm.createContext({
    pathname: '/api/avatar/transformation', req: { method: 'POST' }, res: {},
    requireSession: () => ({ token: 'viewer' }), pointAccountForSession: () => account,
    checkRateLimit: () => true, parseJson: async () => ({ characterId: 'kuromi', mode: 'current' }),
    transformationById, transformationModeAllowed, avatarLookOf, lookFor: (account, equipped) => avatarLookOf(equipped), // v1.10.86 (no tax owed here)
    pointStore: {
      setAvatarTransformation: async () => { saves++; return { ok: true, equipped: saved }; },
      skinState: async () => { reads++; if (readError) throw readError; return { equipped: latest || saved }; },
    },
    equippedSkinCache, plazaPresence, plazaDirty: false,
    getCurrentRoom: () => ({ id: 'room' }), broadcast: () => broadcasts++,
    sendJson: (res, status, data) => ({ status, data }),
    sendError: () => { throw new Error('Unexpected route refusal'); },
    console: { error: (...args) => errors.push(args) },
  });
  const handle = vm.runInContext(`${source.slice(reloadStart, reloadEnd)}\n(async () => { ${source.slice(routeStart, routeEnd)} })`, context);
  return { handle, context, account, saved, errors, counts: () => ({ saves, reads, broadcasts }) };
}

test('체형 저장 뒤 재조회 실패: 성공한 저장을 응답·캐시·광장에 유지한다', async () => {
  const fx = fixture({ readError: new Error('temporary storage read failure') });
  const response = await fx.handle();
  assert.equal(response.status, 200);
  assert.equal(response.data.equipped, fx.saved, '오래된 캐시보다 완료된 저장을 사용');
  assert.equal(response.data.avatar.look.transformationModes.kuromi, 'current');
  assert.equal(response.data.avatar.look.gender, 'female');
  assert.equal(response.data.avatar.look.face.eyes, 'heart');
  assert.equal(fx.context.equippedSkinCache.get(fx.account), fx.saved);
  assert.equal(fx.context.plazaPresence.get('viewer').look.transformationModes.kuromi, 'current');
  assert.equal(fx.context.plazaDirty, true);
  assert.deepEqual(fx.counts(), { saves: 1, reads: 1, broadcasts: 1 });
  assert.equal(fx.errors.length, 1, '일시적인 재조회 오류는 기록');
});

test('체형 저장 뒤 재조회 성공: 뒤이어 저장된 최신 외형이 응답·광장에 우선한다', async () => {
  const latest = { avatar: { ...transformationById('kuromi').items, gender: 'female', hair: 'avatar_hair_1', transformation_kuromi: 'native' } };
  const fx = fixture({ latest });
  const response = await fx.handle();
  assert.equal(response.data.equipped, latest);
  assert.equal(response.data.avatar.look.transformationModes.kuromi, 'native');
  assert.equal(response.data.avatar.look.hair, 'avatar_hair_1');
  assert.equal(fx.context.equippedSkinCache.get(fx.account), latest);
  assert.equal(fx.context.plazaPresence.get('viewer').look.transformationModes.kuromi, 'native');
  assert.deepEqual(fx.counts(), { saves: 1, reads: 1, broadcasts: 1 });
  assert.equal(fx.errors.length, 0);
});
