'use strict';
// 1.10.323 Q1 채석장 (public/plaza/island-quarry.js; notes docs/island-expansion-20261115.md 28A·29B·30A; assets 129·130): the place on
// the ridge, the walk 79 m on from 영웅마루역, the rocks clear of each other with every mining spot standable, the nature cleared; the
// server -- a pickaxe needed, at the spot, the swings' time, an ore and a use of the pickaxe, a rock mined out to its mined look till
// it grows back, a day's count; the week's 손보기 asking 광석 5
// 1.10.342 4a (notes §9, 88A~98B, review-plan §1-8·§1-9): the whole ridge top -- four pieces, 32 rocks each with its main ore, the
// developed look's props clear of the rocks and the mining spots; the crack-light game -- the server's plan, the presses judged (two
// of three, a bonus near the light's middle), a missed set a 작은 돌 and only the pickaxe worn; the ore drawn by the rock's main ore
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const rmAtExit = require('../test-support/rm-at-exit');
const { boot } = require('../test-support/test-server');
const Q = require('../public/plaza/island-quarry.js');
const T = require('../public/plaza/island-terrain.js');
const Farm = require('../public/plaza/island-farm.js');
const Items = require('../lib/island-items');
const Ores = require('../lib/island-ores');

test('채석장 자리: 네 조각 안 바위 40개(광석 차등), 캐는 자리 모두 설 수 있음, 79 m 길, 자연물 없음, 막힘', () => {
  assert.equal(Q.AREA.length, 4); assert.equal(Q.ROCKS.length, 40);
  const per = {}; for (const r of Q.ROCKS) per[r.ore] = (per[r.ore] || 0) + 1;
  assert.deepEqual(per, { granite: 8, clay: 7, coal: 6, iron: 5, copper: 3, silver: 1, crystal: 1, gold: 1, sandstone: 3, tin: 2, jade: 2, obsidian: 1 }, '88A 바위 수 + 366 광석 개편 2 (사암 3·주석 2·옥 2·흑요석 1)');
  let walk = 0; for (let i = 1; i < Q.WALK.length; i += 1) walk += Math.hypot(Q.WALK[i].x - Q.WALK[i - 1].x, Q.WALK[i].z - Q.WALK[i - 1].z);
  assert.ok(walk > 74 && walk < 84, `길 ${walk.toFixed(1)} m`); assert.ok(T.walkDist(Q.WALK.at(-1).x, Q.WALK.at(-1).z) < 0, '길이 채석장까지');
  const solids = T.structureSolids();
  for (const r of Q.ROCKS) {
    assert.ok(Q.inArea(r.x, r.z), `${r.id} 채석장 안`); assert.ok(T.heightAt(r.x, r.z) > 19, `${r.id} 절벽 위`);
    for (const o of Q.ROCKS) if (o !== r) assert.ok(Math.hypot(o.x - r.x, o.z - r.z) > 5, `${r.id}·${o.id} 떨어짐`);
    for (let i = 0; i < Q.spotCount(r); i += 1) for (const stage of ['full', 'mined']) {
      const s = Q.standOf(r, stage, i); assert.ok(T.walkable(s.x, s.z), `${r.id} ${stage} ${i} 설 수 있음`);
      assert.ok(solids.every((o) => Math.hypot(o.x - s.x, o.z - s.z) > o.r), `${r.id} ${stage} ${i} 막힘 밖`);
      const tip = { x: s.x + Math.sin(s.yaw) * 1.0 - Math.cos(s.yaw) * 0.08, z: s.z + Math.cos(s.yaw) * 1.0 + Math.sin(s.yaw) * 0.08 }; assert.ok(Math.hypot(tip.x - s.S.x, tip.z - s.S.z) < 0.01, '곡괭이 끝이 그 자리에');
    }
  }
  const mined = Q.standOf(Q.ROCKS[0], 'mined', 0); const full = Q.standOf(Q.ROCKS[0], 'full', 0); assert.ok(Math.hypot(mined.x - full.x, mined.z - full.z) > 0.08, '캔 뒤 자리는 안쪽');
  const n = T.nature(); for (const k of ['trees', 'bushes', 'rocks', 'logs']) assert.equal((n[k] || []).filter((p) => Q.inArea(p.x, p.z)).length, 0, `${k} 치움`);
  assert.equal(solids.filter((s) => s.quarry).length, 40, '바위 막힘');
  // the props: every one's circles in the solids, clear of the rocks; the rail's buffers solid, its pieces walked over
  assert.equal(Q.PROPS.length, 64); assert.equal(Q.RAIL.length, 67);
  const props = solids.filter((s) => s.quarryProp); assert.ok(props.length > 100, `소품 막힘 ${props.length}`);
  for (const p of props) for (const r of Q.ROCKS) assert.ok(Math.hypot(p.x - r.x, p.z - r.z) > p.r + Q.SOLIDS[r.kind].r, `${p.quarryProp}·${r.id} 겹치지 않음`);
  for (const p of [...Q.PROPS, ...Q.RAIL]) { assert.ok(T.walkable(p.x, p.z) && T.heightAt(p.x, p.z) > 19, `${p.model} (${p.x}, ${p.z}) 능선 위`); if (!/^bench_face/.test(p.model)) assert.ok(Q.inArea(p.x, p.z, 4), `${p.model} (${p.x}, ${p.z}) 채석장 곁`); }
  // the four pieces: the waterfall's pond outside, the seam between two pieces no edge
  assert.equal(Q.inArea(122.5, -79), false, '폭포 머리 연못 밖'); const at = (a, r) => [Math.cos((a * Math.PI) / 180) * r, Math.sin((a * Math.PI) / 180) * r];
  assert.ok(Q.edgeDist(...at(320, 155)) > 3, '가운데·폭포 목 이음은 가장자리 아님'); assert.ok(Math.abs(Q.edgeDist(...at(320, 140))) < 0.5, '진짜 가장자리');
  assert.equal(Q.deckLift(Q.DECK.x, Q.DECK.z), 0.45, '전망 발판 위'); assert.ok(T.heightAt(Q.DECK.x, Q.DECK.z) > T.heightAt(Q.DECK.x + 3, Q.DECK.z) + 0.2, '발판 높이로 섬');
  // the items: the eight ores (흔함 200P -- 화강암 50P since 1.10.350 사용자 182 --, 보통 300P at the merchant; the rare ones not his), the 곡괭이, the week's 손보기 화강암 5
  assert.equal(Items.ITEMS.ore.name, '광석'); assert.equal(Items.TOOL_KIND.pickaxe, 'pickaxe'); assert.equal(Items.TOOL_USES.pickaxe, 40); assert.ok(Items.QUICK_KINDS.includes('pickaxe'));
  assert.deepEqual(Ores.ORES.map((o) => `${o.id}:${Items.ITEMS[`ore_${o.id}`].at}:${Items.ITEMS[`ore_${o.id}`].price}`), ['granite:merchant:50', 'clay:merchant:800', 'sandstone:merchant:800', 'coal:merchant:1200', 'iron:merchant:1200', 'copper:merchant:1200', 'tin:merchant:1200', 'silver:merchant:3000', 'crystal:merchant:3500', 'jade:merchant:3500', 'gold:merchant:8000', 'obsidian:merchant:8000']); /* (362 광석 값 사용자 1A: the merchant buys them all; 366 광석 개편 2 「낚시랑 맞춰」) */
  assert.deepEqual(Ores.GEMS.map((g) => `${g.id}:${Items.ITEMS[`gem_${g.id}`].at}:${Items.ITEMS[`gem_${g.id}`].price}:${Boolean(Items.ITEMS[`gem_${g.id}`].shop)}`), ['moonstone:merchant:50000:false', 'ruby:merchant:100000:false', 'sapphire:merchant:100000:false', 'emerald:merchant:100000:false'], '366 보석: 상인만 사고 잡화점은 안 팜');
  { const E = require('../lib/economy'); assert.equal(E.value('ore:shopMul'), 3); assert.deepEqual(['stone', 'ore_granite', 'ore_clay', 'ore_iron', 'ore_gold'].map((id) => E.shopOrePrice(id)), [300, 150, 2400, 3600, 24000], '잡화점은 상인 값의 3배'); assert.equal(Items.ITEMS.stone.price, 100); }
  assert.equal(Farm.upkeepNeed(1).ore, 5); assert.equal(Farm.upkeepNeed(4).ore, 10); assert.equal(Farm.UPKEEP_NAMES.ore, '화강암'); assert.deepEqual(Farm.UPKEEP_ITEMS.ore, ['ore_granite', 'ore']);
});

test('캐기 판정: 빛 창 + 여유 300 ms, 가운데 ±150 ms 보너스, 세 번 중 두 번 · 광석 확률(94B) · 다시 차는 시간', () => {
  const rock = Q.ROCKS.find((r) => r.ore === 'gold'); assert.equal(Q.lightOf(rock), 600); assert.equal(Q.lightOf(Q.ROCKS[0]), 1000); assert.equal(Q.lightOf(Q.ROCKS.find((r) => r.ore === 'crystal')), 800);
  assert.equal(Q.regrowOf(rock), 12 * 3600000); assert.equal(Q.regrowOf(Q.ROCKS[0]), 3 * 3600000); assert.equal(Q.regrowOf(Q.ROCKS.find((r) => r.ore === 'silver')), 6 * 3600000);
  let k = 7; const rnd = () => { k = (k * 9301 + 49297) % 233280; return k / 233280; };
  const plan = Q.planOf(rock, rnd); assert.equal(plan.length, Q.ROUNDS);
  for (const p of plan) { assert.ok(p.spot >= 0 && p.spot < Q.CRACKS.length); assert.ok(p.at + p.light + Q.GRACE_MS < Q.ROUND_MS, '한 번 안에 끝남'); }
  assert.deepEqual(Q.judge(plan, plan.map((p) => ({ spot: p.spot, ms: p.light / 2 }))), { hits: 3, bonus: 3, done: true });
  assert.deepEqual(Q.judge(plan, plan.map((p) => ({ spot: p.spot, ms: p.light + Q.GRACE_MS }))), { hits: 3, bonus: 0, done: true }, '여유 300 ms');
  assert.equal(Q.judge(plan, plan.map((p) => ({ spot: p.spot, ms: p.light + Q.GRACE_MS + 1 }))).hits, 0, '너무 늦음');
  assert.equal(Q.judge(plan, plan.map((p) => ({ spot: p.spot, ms: -1 }))).hits, 0, '빛 전');
  assert.equal(Q.judge(plan, plan.map((p) => ({ spot: (p.spot + 1) % Q.CRACKS.length, ms: p.light / 2 }))).hits, 0, '다른 금');
  assert.deepEqual(Q.judge(plan, [{ spot: plan[0].spot, ms: 10 }, null, { spot: plan[2].spot, ms: 500 }]), { hits: 2, bonus: 0, done: true }, '두 번이면 광석');
  assert.equal(Q.judge(plan, [{ spot: plan[0].spot, ms: 10 }]).done, false, '한 번은 부스러기');
  // 94B: common its own, else a tier up (366: 15 -> 20 %, a bonus 35 %); silver/crystal/jade 40 %; gold/obsidian 15 % (else the tier below)
  const share = (main, bonus) => { const c = {}; for (let i = 0; i < 1000; i += 1) { const o = Ores.drawOre(main, i / 1000, bonus); c[o] = (c[o] || 0) + 1; } return c; };
  assert.equal(share('granite', false).granite, 800); assert.equal(share('granite', true).granite, 650); assert.equal(share('silver', false).silver, 400); assert.equal(share('gold', false).gold, 150);
  assert.deepEqual(Object.keys(share('gold', false)).sort(), ['crystal', 'gold', 'jade', 'silver']); assert.deepEqual(Object.keys(share('coal', false)).sort(), ['coal', 'crystal', 'jade', 'silver']);
  assert.deepEqual(Object.keys(share('granite', false)).sort(), ['coal', 'copper', 'granite', 'iron', 'tin']);
  // 366 보석: 달빛석 0.5 % from any rock, 루비·사파이어·에메랄드 0.7 % each only from 드묾 and above; a bonus 1.5 % / 2 %
  const gems = (main, bonus, mult = 1) => { const c = {}; for (let i = 0; i < 100000; i += 1) { const g = Ores.drawGem(main, (i + 0.5) / 100000, bonus, mult); if (g) c[g] = (c[g] || 0) + 1; } return c; };
  assert.deepEqual(gems('granite', false), { moonstone: 500 }); assert.deepEqual(gems('coal', true), { moonstone: 1500 });
  assert.deepEqual(gems('silver', false), { moonstone: 500, ruby: 700, sapphire: 700, emerald: 700 }); assert.deepEqual(gems('obsidian', true), { moonstone: 1500, ruby: 2000, sapphire: 2000, emerald: 2000 });
  assert.deepEqual(gems('silver', false, 2), { moonstone: 1000, ruby: 1400, sapphire: 1400, emerald: 1400 }, '이벤트 배수');
  assert.equal(Ores.drawGem('gold', 0.0001, false, 1, { moonstone: [0, 0], ruby: [0, 0], sapphire: [0, 0], emerald: [1, 1] }), 'emerald', '경제 표의 ‰');
  // 366 「캐기 한 번 ≈ 낚시 한 번(약 1,400P)」: one piece's merchant value, gems in -- over the 40 rocks alike, and as often as each grows back
  const worth = (main) => { let s = 0; const N = 4000; let gp = 0; let gv = 0; for (const g of Ores.GEMS) if (!g.rare || Ores.oreOf(main).tier >= 2) { gp += g.pm / 1000; gv += (g.pm / 1000) * g.price; }
    for (let i = 0; i < N; i += 1) s += Items.ITEMS[`ore_${Ores.drawOre(main, (i + 0.5) / N)}`].price; return gv + (1 - gp) * (s / N); };
  const even = Q.ROCKS.reduce((n, r) => n + worth(r.ore), 0) / Q.ROCKS.length; let tw = 0; let w = 0; for (const r of Q.ROCKS) { const k = 1 / Ores.regrowOf(r.ore); tw += k * worth(r.ore); w += k; }
  assert.ok(even > 1800 && even < 1970, `바위 고르게 ${Math.round(even)}P`); assert.ok(tw / w > 1500 && tw / w < 1650, `다시 차는 만큼 ${Math.round(tw / w)}P (못 맞힘 20 %면 약 1,275P)`);
});

test('채석장 서버: 곡괭이·자리·캐기 → 주 광석 · 곡괭이 닳음 · 못 맞히면 작은 돌만 · 다 캐면 캔 모습 → 다시 자람', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quarry-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server; const a = await server.enter(await server.issue('광부'));
  const rock = Q.ROCKS[0]; const stand = Q.standOf(rock, 'full', 0);
  const v0 = (await req('/api/island/quarry', a)).data; assert.equal(v0.rocks.length, 40); assert.ok(v0.rocks.every((r) => r.left === Q.ORE_PER_ROCK && r.stage === 'full')); assert.deepEqual(v0.daily, { n: 0, max: Q.DAILY }); assert.equal(v0.rocks[0].ore, 'granite');
  await req('/api/plaza/state', a, { x: stand.x, z: stand.z, yaw: stand.yaw, moving: false });
  assert.equal((await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 })).data.error, 'NO_PICKAXE');
  await req('/api/test/island/give', a, { itemId: 'pickaxe', qty: 1 });
  await req('/api/plaza/state', a, { x: stand.x + 5, z: stand.z, yaw: 0, moving: false });
  assert.equal((await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 })).data.error, 'TOO_FAR');
  const mine = async (press, draw = null, gem = null) => {
    await req('/api/plaza/state', a, { x: stand.x, z: stand.z, yaw: stand.yaw, moving: false });
    if (draw !== null) await req('/api/test/quarry/plan', a, { draw, ...(gem !== null ? { gem } : {}) });
    const s = await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 }); assert.equal(s.status, 200, JSON.stringify(s.data)); assert.equal(s.data.ms, Q.MINE_MS); assert.equal(s.data.plan.length, Q.ROUNDS); assert.equal(s.data.ore, 'granite');
    const t0 = Date.now(); const taps = s.data.plan.map((p) => ({ spot: p.spot, ms: 200 })); /* (1.10.351: the page's list at finish is not read -- a forged one) */
    const rid = crypto.randomUUID(); assert.equal((await req('/api/island/quarry/finish', a, { rock: rock.id, spot: 0, taps, requestId: rid })).data.error, 'COLLECT_TOO_SOON');
    if (press) await pressTimed(s.data.plan, t0);
    await new Promise((r) => setTimeout(r, Math.max(0, t0 + Q.MINE_MS - Date.now())));
    const f = await req('/api/island/quarry/finish', a, { rock: rock.id, spot: 0, taps, requestId: rid }); assert.equal(f.status, 200, JSON.stringify(f.data));
    assert.deepEqual((await req('/api/island/quarry/finish', a, { rock: rock.id, spot: 0, taps, requestId: rid })).data, f.data, '같은 요청은 한 번'); return f.data;
  };
  // 1.10.351 (Codex 341-350 P1): each press sent when it happens, 200 ms into its light
  const pressTimed = async (plan, t0) => { for (const [k, p] of plan.entries()) { await new Promise((r) => setTimeout(r, Math.max(0, t0 + k * Q.ROUND_MS + p.at + 200 - Date.now()))); assert.equal((await req('/api/island/quarry/tap', a, { round: k, spot: p.spot, ms: 200 })).status, 200); } };
  const miss = await mine(false); assert.equal(miss.ore, 0); assert.equal(miss.itemId, 'stone'); assert.equal(miss.left, Q.ORE_PER_ROCK, '바위 그대로'); assert.equal(miss.worn.uses, Items.TOOL_USES.pickaxe - 1, '곡괭이만 닳음');
  assert.equal((await req('/api/island/quarry', a)).data.daily.n, 1, '362 Codex P1 #1: 작은 돌도 하루 한도에 셈(일부러 놓쳐 남기기 막음)'); assert.equal(miss.daily.n, 1);
  const f1 = await mine(true, 0.1); assert.equal(f1.ore, 1); assert.equal(f1.itemId, 'ore_granite'); assert.equal(f1.name, '화강암'); assert.equal(f1.hits, 3); assert.equal(f1.left, Q.ORE_PER_ROCK - 1); assert.equal(f1.worn.uses, Items.TOOL_USES.pickaxe - 2); assert.equal(f1.daily.n, 2);
  await req('/api/test/quarry/set', a, { rock: rock.id, left: 1 }); /* (1.10.350: six a rock -- the last one) */
  const f2 = await mine(true, 0.82); assert.equal(f2.itemId, 'ore_coal', '한 단계 위 20 %(보통: 석탄·철·구리·주석)'); assert.equal(f2.left, 0); assert.equal(f2.stage, 'mined');
  const bag = (await req('/api/island/bag', a)).data; const items = bag.bag?.items || bag.items || []; const count = (id) => items.filter((e) => e.itemId === id).reduce((n, e) => n + e.qty, 0);
  assert.equal(count('ore_granite'), 1); assert.equal(count('ore_coal'), 1); assert.equal(count('stone'), 1);
  assert.equal((await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 })).data.error, 'MINED');
  assert.equal((await req('/api/island/quarry', a)).data.rocks.find((r) => r.id === rock.id).stage, 'mined');
  const back = (await req('/api/test/quarry/regrow', a, {})).data; assert.equal(back.rocks.find((r) => r.id === rock.id).left, Q.ORE_PER_ROCK, '다시 자람');
  // 366 광석 개편 2: a gem instead of the ore -- the first of each its card (once an account), the island told
  const g1 = await mine(true, 0.1, 0.001); assert.equal(g1.itemId, 'gem_moonstone'); assert.equal(g1.gem, 'moonstone'); assert.equal(g1.name, '달빛석');
  assert.deepEqual(g1.firstGem, { id: 'moonstone', title: '첫 달빛석이에요!', line: require('../lib/gem-cards.json').moonstone.line, card: '/assets/items/cards/gem_moonstone_card.webp' });
  const g2 = await mine(true, 0.1, 0.001); assert.equal(g2.itemId, 'gem_moonstone'); assert.equal(g2.firstGem, undefined, '두 번째는 카드 없음');
  assert.equal((await mine(true, 0.1)).itemId, 'ore_granite', '정한 광석 뽑기에는 보석 없음');
  // 1.10.350 화강암 벽 (사용자 182): granite only, never empty, outside the day's count -- the rocks shut at DAILY, the wall not
  assert.deepEqual([Q.DAILY, Q.ORE_PER_ROCK], [60, 8], '사용자 2026-11-17: 하루 60 · 366 바위 8');
  await req('/api/test/quarry/set', a, { daily: Q.DAILY }); await req('/api/plaza/state', a, { x: stand.x, z: stand.z, yaw: stand.yaw, moving: false });
  assert.equal((await req('/api/island/quarry/start', a, { rock: rock.id, spot: 0 })).data.error, 'DAILY_CAP', '바위는 하루 한도');
  const ws = Q.standOf(Q.WALL, 'full', 1); const wallMine = async (how = 'press') => { await req('/api/plaza/state', a, { x: ws.x, z: ws.z, yaw: ws.yaw, moving: false }); await req('/api/test/quarry/plan', a, { draw: 0.99 }); const s = await req('/api/island/quarry/start', a, { rock: 'wall', spot: 1 }); assert.equal(s.status, 200, JSON.stringify(s.data)); assert.equal(s.data.ore, 'granite'); const t0 = Date.now(); const taps = s.data.plan.map((p) => ({ spot: p.spot, ms: 200 }));
    if (how === 'press') await pressTimed(s.data.plan, t0); await new Promise((r) => setTimeout(r, Math.max(0, t0 + Q.MINE_MS - Date.now())));
    if (how === 'late') for (const [k, p] of s.data.plan.entries()) await req('/api/island/quarry/tap', a, { round: k, spot: p.spot, ms: 200 }); /* (the plan's taps all sent at the end, as Codex's forge) */
    const f = await req('/api/island/quarry/finish', a, { rock: 'wall', spot: 1, taps, requestId: crypto.randomUUID() }); assert.equal(f.status, 200, JSON.stringify(f.data)); return f.data; };
  const w1 = await wallMine(); assert.equal(w1.itemId, 'ore_granite', '벽은 화강암만 (확률 0.99에도)'); assert.equal(w1.wall, true); assert.equal(w1.left, null); assert.equal(w1.daily.n, Q.DAILY, '한도에 안 들어감');
  const w2 = await wallMine(); assert.equal(w2.itemId, 'ore_granite', '비지 않음');
  // 1.10.351 Codex 341-350: the plan's taps made up and sent at the end -- a miss (P1); a miss at the wall gives nothing (#5)
  const bagOf = async () => { const b = (await req('/api/island/bag', a)).data; return (b.bag?.items || b.items || []).filter((e) => e.itemId === 'stone').reduce((n, e) => n + e.qty, 0); };
  const stones = await bagOf(); const forged = await wallMine('late'); assert.equal(forged.ore, 0, '끝에 몰아 보낸 타격은 늦음'); assert.ok(forged.hits < Q.HITS_NEEDED, `hits ${forged.hits}`); /* (only the last swing's can still fit the trip's allowance) */
  const missed = await wallMine('none'); assert.equal(missed.ore, 0); assert.equal(missed.itemId, null, '벽에서 못 맞히면 작은 돌 없음'); assert.equal(await bagOf(), stones, '작은 돌 그대로');
  { // (1.10.355 「두 번 맞히면 바로 결과」: after the server's own two timed hits, the finish before the swings' end -- one is not enough)
    await req('/api/plaza/state', a, { x: ws.x, z: ws.z, yaw: ws.yaw, moving: false }); const s = await req('/api/island/quarry/start', a, { rock: 'wall', spot: 1 }); assert.equal(s.status, 200, JSON.stringify(s.data)); const t0 = Date.now();
    await pressTimed(s.data.plan.slice(0, 1), t0); assert.equal((await req('/api/island/quarry/finish', a, { rock: 'wall', spot: 1, requestId: crypto.randomUUID() })).data.error, 'COLLECT_TOO_SOON', '한 번은 아직');
    await new Promise((r) => setTimeout(r, Math.max(0, t0 + Q.ROUND_MS + s.data.plan[1].at + 200 - Date.now()))); assert.equal((await req('/api/island/quarry/tap', a, { round: 1, spot: s.data.plan[1].spot, ms: 200 })).status, 200);
    const early = await req('/api/island/quarry/finish', a, { rock: 'wall', spot: 1, requestId: crypto.randomUUID() }); assert.equal(early.status, 200, JSON.stringify(early.data)); assert.equal(early.data.ore, 1); assert.ok(Date.now() - t0 < Q.MINE_MS - 300, '끝나기 전에 결과');
  }
});

test('채석장 타격 시각 (1.10.351 Codex P1): 서버가 받은 시각과 맞는 것만', () => {
  const plan = [{ spot: 1, at: 400, light: 1000 }, { spot: 2, at: 500, light: 1000 }];
  assert.deepEqual(Q.tapAt(plan, 0, { spot: 1, ms: 200 }, 400 + 200 + 80), { spot: 1, ms: 200, bonusMs: 200 }, '오간 시간 80 ms');
  assert.equal(Q.tapAt(plan, 0, { spot: 1, ms: 500 }, 6000).late, true, '끝나고 보낸 것');
  assert.equal(Q.tapAt(plan, 1, { spot: 2, ms: 500 }, 2000 + 500 + 100).late, true, '서버보다 이른 주장');
  assert.equal(Q.judge(plan, [Q.tapAt(plan, 0, { spot: 1, ms: 500 }, 6000), Q.tapAt(plan, 1, { spot: 2, ms: 500 }, 6000)]).hits, 0);
  assert.equal(Q.tapAt(plan, 5, { spot: 1, ms: 1 }, 1), null);
  // 362 Codex 351-360 P1 #2: a press 1.5 s after the light's middle told as its middle (500) -- judged at the server's time less a trip
  const forged = Q.tapAt(plan, 0, { spot: 1, ms: 500 }, 400 + 500 + 1500); assert.equal(forged.bonusMs, 1500 - Q.LAG_ALLOW + 500); assert.deepEqual([Q.judge(plan, [forged, null]).hits, Q.judge(plan, [forged, null]).bonus], [1, 0], '맞기는 하지만 보너스 아님(느린 폰의 정직한 타격도 맞음)');
  assert.equal(Q.judge(plan, [Q.tapAt(plan, 0, { spot: 1, ms: 500 }, 400 + 500 + 200), null]).bonus, 1, '오간 시간 200 ms 정직한 가운데는 보너스');
});
