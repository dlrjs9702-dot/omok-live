'use strict';
// 1.10.430 인벤토리 2차 (notes docs/bag-tabs-20261117.md 결정 「1A 2A 3A」, docs/inventory-2-plan-20261124.md): each kind its own room --
// tools 8, fish · insects · 채집물 · 광석 · 재료 10 until their container (50 -> 100 -> 200), the rest 10, rides a list; the things stay
// where they were (one list), an old box's mark kept; who bought the bag's 24 or 32 has the 채집 바구니's 50 free
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const I = require('../lib/island-items');
const Economy = require('../lib/economy');
const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

const fill = (itemId, n, cap) => { let e = []; for (let k = 0; k < n; k += 1) { const next = I.addToBag(e, itemId, 1, `${itemId}-${k}`, I.fishOf(itemId) ? { size: 20 } : null, cap); if (!next) return { e, at: k }; e = next; } return { e, at: n }; };

test('430 종류 표: 물고기 · 곤충 · 도구 · 탈것은 서버가 알고, 나머지는 가방 탭 표 하나(광석 · 재료는 한 칸 묶음)', () => {
  const kinds = { fish_carp: 'fish', insect_cicada: 'insect', fishing_rod: 'tool', pickaxe: 'tool', bike_red: 'ride', pet_puppy: 'ride', ore_iron: 'material', gem_ruby: 'material', bait: 'material', seed_carrot: 'material', compost: 'material', herb: 'gather', branch: 'gather', weed: 'gather', stone: 'gather', crop_carrot: 'gather', wallet: 'etc', lost: 'etc', candy: 'etc', trash: 'etc', firework: 'etc' };
  for (const [id, kind] of Object.entries(kinds)) assert.equal(I.sectionOf(id), kind, id);
  assert.deepEqual(I.SECTIONS, { tool: 8, fish: 10, insect: 10, gather: 10, material: 10, furniture: 10, etc: 10, ride: Infinity });
});

test('430 칸: 종류마다 따로 -- 10번째까지 들어가고 11번째는 안 됨, 다른 종류는 제 칸; 도구 8; 탈것은 칸 없음', () => {
  const cap = I.capOf('nobody');
  for (const id of ['fish_carp', 'herb', 'ore_iron', 'firework']) { const max = id === 'fish_carp' ? 10 : 10; assert.equal(fill(id, 99, cap).at, id === 'fish_carp' ? max : 99, id); } /* (stackables: one stack takes 99 -- one slot) */
  const kinds = ['herb', 'berry', 'mushroom', 'mushroom_blue', 'branch', 'twig', 'clover_four', 'weed', 'harvest', 'stone'];
  let e = []; for (const id of kinds) e = I.addToBag(e, id, 1, id, null, cap); assert.equal(I.usedIn(e, 'gather'), 10);
  assert.equal(I.addToBag(e, 'mushroom_glow', 1, 'x', null, cap), null, '11번째 채집물');
  assert.ok(I.addToBag(e, 'herb', 5, 'x', null, cap), '있는 묶음에는 쌓임');
  assert.ok(I.addToBag(e, 'ore_iron', 1, 'x', null, cap), '광석은 제 칸'); assert.ok(I.addToBag(e, 'fish_carp', 1, 'x', { size: 20 }, cap), '물고기는 제 칸');
  assert.equal(fill('fish_carp', 99, cap).at, 10, '물고기 한 마리 한 칸, 10');
  let t = []; for (const id of ['fishing_rod', 'fishing_rod_sturdy', 'bugnet', 'bugnet_sturdy', 'pickaxe', 'fishing_rod', 'bugnet', 'pickaxe']) t = I.addToBag(t, id, 1, `${id}-${t.length}`, null, cap); assert.equal(I.usedIn(t, 'tool'), 8);
  assert.equal(I.addToBag(t, 'fishing_rod', 1, 'r9', null, cap), null, '도구 9번째');
  let r = []; for (const id of ['bike_red', 'bike_mint', 'bike_sky', 'bike_butter', 'pet_puppy', 'pet_kitten', 'pet_bird']) for (let k = 0; k < 3; k += 1) r = I.addToBag(r, id, 1, `${id}${k}`, null, { ...cap, ride: Infinity }); assert.equal(r.reduce((n, x) => n + x.qty, 0), 21, '탈것 · 펫은 칸 없음');
  assert.equal(I.bagView(r, Date.now(), null, cap).sections.ride.slots, null);
});

test('430 넘친 채 옮겨도 잃는 것 없음: 옛 가방이 한 종류에 많으면 그대로 두고 새로만 못 받음, 팔면 다시 받음', () => {
  const old = Array.from({ length: 14 }, (_, k) => ({ entryId: `w${k}`, itemId: 'wallet', qty: 1 })); /* (기타 10에 14) */
  const cap = I.capOf('nobody'); const view = I.bagView(old, Date.now(), null, cap);
  assert.deepEqual(view.sections.etc, { used: 14, slots: 10 }); assert.equal(view.items.length, 14, '모두 그대로');
  assert.equal(I.addToBag(old, 'candy', 1, 'c', null, cap), null); assert.ok(I.addToBag(old.slice(5), 'candy', 1, 'c', null, cap), '9칸이 되면 다시 받음');
});

test('430 그릇: 채집 바구니 · 재료 상자 50 → 100 → 200(30만 · 80만 · 200만P, 관리자 경제 값), 물고기 통 표시는 그대로(429로 되돌려도 같은 통)', () => {
  assert.deepEqual(Object.keys(I.BOX_KINDS), ['fish', 'insect', 'gather', 'material']); assert.deepEqual([I.BOX_KINDS.gather.name, I.BOX_KINDS.material.name], ['채집 바구니', '재료 상자']);
  for (const k of ['basket', 'matbox']) assert.deepEqual([50, 100, 200].map((n) => Economy.value(`${k}:${n}`)), [300000, 800000, 2000000], k);
  const boxes = new Map([['u|gather', 100], ['u|material', 50], ['u|fish', 50]]); I.setBoxHook((a, k) => boxes.get(`${a}|${k}`));
  try {
    const cap = I.capOf('u'); assert.deepEqual([cap.gather, cap.material, cap.fish, cap.insect, cap.boxes.fish], [100, 50, 50, 10, 50]);
    assert.equal(fill('herb', 1, cap).at, 1); let e = []; for (let k = 0; k < 100; k += 1) e = I.addToBag(e, k % 2 ? 'herb' : 'berry', 99, `g${k}`, null, cap) || e; assert.equal(I.usedIn(e, 'gather'), 100);
    const f = fill('fish_carp', 50, cap).e; assert.ok(f.every((x) => x.meta.box === 'fish'), '물고기 통 칸 안은 통 표시'); assert.equal(I.boxFor('herb'), null, '새 그릇은 표시 없음');
  } finally { I.setBoxHook(() => null); }
});

test('430 결정 3A: 가방 24 · 32칸을 산 사람은 채집 바구니 50 무료 -- 읽을 때도, 서버가 켜질 때 한 번(깃발) 적어 둠; 다음 단계는 100', () => {
  const slots = new Map([['a', 24], ['b', 32]]); I.setSlotsHook((u) => slots.get(u));
  try {
    assert.deepEqual(['a', 'b', 'c'].map((u) => I.boxNow(u, 'gather')), [50, 50, 0]); assert.deepEqual(['a', 'b', 'c'].map((u) => I.capOf(u).gather), [50, 50, 10]);
    assert.equal(I.BOX_GROW.find((n) => n > I.boxNow('a', 'gather')), 100);
  } finally { I.setSlotsHook(() => null); }
  assert.match(server, /if \(!\(await pointStore\.worldValue\('bagKinds430'\)\.catch\(\(\) => true\)\)\) \{/);
  assert.match(server, /await pointStore\.setWorldValue\('bagKinds430', \{ at: Date\.now\(\), given \}\)/);
  assert.match(server, /IslandItems\.BOX_GROW\.find\(\(s\) => s > IslandItems\.boxNow\(account, kind\)\)/); assert.match(server, /const now = IslandItems\.boxNow\(account, kind\);/);
});

test('430 가득 말: 어느 종류 칸인지 · 늘리는 그릇, BAG_FULL은 모두 bagFull로; 마당 잡초는 자리 먼저 보고 뽑음(잃지 않음)', () => {
  assert.equal((server.match(/'BAG_FULL'/g) || []).length, 2, 'bagFull 하나 + 공방 빚(만든 물건 이름)'); assert.ok((server.match(/bagFull\(res, /g) || []).length >= 16);
  assert.match(server, /const BOX_TO = \{ fish: '물고기 통으로', insect: '곤충 채집통으로', gather: '채집 바구니로', material: '재료 상자로' \};/);
  assert.match(server, /const out = await pointStore\.pullYardWeed\(\{ owner, userId: account/);
  assert.match(server, /if \(!out\.applied\) return out\.reason === 'full' \? bagFull\(res, 'weed'\)/);
});

test('430 화면(결정 88): 종류 탭 여덟 · 「전체」 없음 · 마지막 본 탭, 탭마다 n/칸과 빈 칸 · 꽉 참 표시, 그 탭의 그릇 단추; 가방 늘리기 · 통 창 없음', () => {
  const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
  assert.match(app, /const BAG_SECTIONS = \[\['fish', '물고기'\], \['insect', '곤충'\], \['gather', '채집물'\], \['material', '광석·재료'\], \['tool', '도구'\], \['ride', '탈것·펫'\], \['furniture', '가구'\], \['etc', '기타'\]\];/);
  assert.doesNotMatch(app, /bagTab === 'all'/); assert.match(app, /return BAG_SECTIONS\.some\(\(\[s\]\) => s === k\) \? k : BAG_SECTIONS\[0\]\[0\];/);
  assert.match(app, /const room = bagRooms\?\.\[bagTab\]\?\.slots; const empties = Number\.isFinite\(room\) \? Math\.max\(0, room - shown\.length\) : 0;/);
  assert.match(app, /b\.classList\.toggle\('full', Number\.isFinite\(room\) && n >= room\);/);
  assert.match(app, /api\('\/api\/island\/box\/grow', \{ method: 'POST', body: JSON\.stringify\(\{ kind, to: next\.slots \}\) \}\)/);
  assert.doesNotMatch(app, /api\('\/api\/island\/bag\/grow'/, '가방 늘리기 단추 없음(결정 88 5A)');
  assert.match(app, /for \(const \[id\] of BOX_BTNS\) byId\(id\)\.classList\.add\('hidden'\);/);
});