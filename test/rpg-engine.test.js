'use strict';

// 잿빛 원정 (1~4인 협동 3D 로그라이크) engine: data integrity, server-side movement/collision,
// combat, progression (level-up choices, stats, items), room flow, boss, downs/revives, party
// scaling, and full runs played by a simple bot through the real engine to the boss.
const test = require('node:test');
const assert = require('node:assert/strict');
const rpg = require('../lib/games/rpg');
const D = require('../lib/games/rpg/data');

function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function startRun(classes, seed = 1) {
  const game = rpg.create();
  const seats = classes.map((_, i) => String(i + 1));
  seats.forEach((seat, i) => assert.equal(rpg.setClass(game, seat, classes[i]).legal, true));
  assert.equal(rpg.start(game, seats, { random: seeded(seed) }).legal, true);
  return { game, seats };
}

function runTicks(game, seconds) { for (let i = 0; i < Math.round(seconds / D.TICK); i += 1) rpg.tick(game); }

// A deliberately simple player: walk at the nearest enemy (keeping range for ranged classes),
// dodge telegraphs, hold attack, cast every ready skill, and resolve every between-room choice.
function bot(game, seat, rng) {
  const p = game.players[seat];
  if (game.phase === 'intermission') {
    while (p.choices) rpg.chooseLevelUp(game, seat, 0);
    if (p.itemChoices) rpg.chooseItem(game, seat, 0);
    while (p.statPoints > 0) rpg.allocateStat(game, seat, D.STATS[p.statPoints % 5]);
    if (!p.ready) rpg.setReady(game, seat, true);
    return;
  }
  if (p.state !== 'ok') return;
  const foes = game.mobs.filter(m => !m.ally && m.hp > 0).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  const target = foes[0];
  const danger = game.hazards.find(h => h.owner === 'm' && !h.fired && Math.hypot(h.x - p.x, h.z - p.z) < (h.r || 3) + 1);
  let mv = 0;
  const bits = (dx, dz) => (dx > 0.3 ? 8 : dx < -0.3 ? 4 : 0) | (dz > 0.3 ? 2 : dz < -0.3 ? 1 : 0);
  if (danger) { mv = bits(p.x - danger.x, p.z - danger.z); if (game.time > p.cds.dash) rpg.act(game, seat, 'dash'); }
  else if (target) {
    const d = Math.hypot(target.x - p.x, target.z - p.z);
    const want = p.cls === 'guardian' ? 1.8 : 7;
    mv = bits((target.x - p.x) * Math.sign(d - want), (target.z - p.z) * Math.sign(d - want));
  }
  p.botHist = [...(p.botHist || []), [p.x, p.z]].slice(-12);
  if (p.botUnstick > game.time) mv = p.botUnstickMv;
  else if (mv && p.botHist.length === 12 && Math.hypot(p.x - p.botHist[0][0], p.z - p.botHist[0][1]) < 0.3) { p.botUnstick = game.time + 1; p.botUnstickMv = [1, 2, 4, 8][Math.floor(rng() * 4)]; mv = p.botUnstickMv; }
  rpg.input(game, seat, { mv, atk: Boolean(target) });
  for (const key of ['q', 'w', 'e', 'r']) if (target && p.skills[key] && game.time > p.cds[key]) rpg.act(game, seat, key);
  if (p.hp < p.maxHp * 0.35) rpg.act(game, seat, 'item1');
}

function playOut(game, seats, { seconds = 900, seed = 5 } = {}) {
  const rng = seeded(seed);
  let maxMobs = 0;
  for (let step = 0; step < seconds / D.TICK && game.status === 'playing'; step += 1) {
    if (step % 3 === 0) for (const seat of seats) bot(game, seat, rng);
    rpg.tick(game);
    maxMobs = Math.max(maxMobs, game.mobs.length);
  }
  return { maxMobs };
}

// ---- data ----------------------------------------------------------------------------------

test('데이터: 3개 역할, 스킬·진화·패시브·아이템·몬스터·방 참조가 모두 유효하다', () => {
  assert.deepEqual(Object.keys(D.CLASSES), ['guardian', 'hunter', 'arcanist']);
  const modIds = new Set();
  for (const [cls, c] of Object.entries(D.CLASSES)) {
    assert.ok(D.SKILLS[c.q], `${cls} Q`);
    assert.equal(c.learnable.length, 3, `${cls}는 W/E/R 세 칸을 채울 스킬 후보가 있다`);
    for (const sk of [c.q, ...c.learnable]) {
      assert.equal(D.SKILLS[sk].cls, cls);
      for (const mod of D.SKILLS[sk].mods) {
        assert.equal(modIds.has(mod.id), false, `진화 id 중복 ${mod.id}`); modIds.add(mod.id);
        if (mod.requires) assert.ok(D.SKILLS[sk].mods.some(x => x.id === mod.requires), `${mod.id} 선행`);
      }
    }
  }
  for (const item of D.ITEMS) { assert.ok(['weapon', 'armor', 'trinket'].includes(item.slot)); assert.ok(D.RARITY[item.rarity]); assert.ok(item.desc); }
  assert.ok(D.ITEMS.some(item => item.rarity === 'legendary'));
  const normal = Object.entries(D.MONSTERS).filter(([, m]) => !m.elite && !m.boss && m.ai !== 'ally');
  assert.equal(normal.length, 5);
  assert.equal(new Set(normal.map(([, m]) => m.ai)).size >= 4, true, '일반 몬스터끼리 행동 방식이 다르다');
  assert.ok(Object.values(D.MONSTERS).some(m => m.elite));
  const boss = D.MONSTERS.boss;
  for (const key of ['swipe', 'breath', 'charge', 'circles']) assert.ok(boss.patterns[key].windup >= 0.6, `${key} 경고 시간`);
  assert.ok(boss.phases.length >= 1);
  assert.deepEqual(D.REGION.rooms.map(r => r.kind), ['combat', 'combat', 'treasure', 'elite', 'combat', 'treasure', 'combat', 'boss']);
  for (const room of D.REGION.rooms) for (const layout of room.layouts) assert.ok(D.LAYOUTS[layout], layout);
  assert.ok(Object.keys(D.LAYOUTS).length >= 5);
  assert.ok(Object.values(D.LAYOUTS).some(l => l.bounds.type === 'circle'));
  assert.ok(Object.values(D.LAYOUTS).some(l => l.obstacles.some(o => o.type === 'circle')) && Object.values(D.LAYOUTS).some(l => l.obstacles.some(o => o.type === 'box')));
});

// ---- lobby / start ---------------------------------------------------------------------------

test('시작: 1~4명, 모두 역할을 골라야 하고 같은 역할 중복 가능', () => {
  const game = rpg.create();
  assert.equal(rpg.setClass(game, '1', 'cleric').legal, false);
  rpg.setClass(game, '1', 'hunter');
  assert.equal(rpg.start(game, ['1', '2']).reason, 'no-class');
  rpg.setClass(game, '2', 'hunter');
  assert.equal(rpg.start(game, []).reason, 'player-count');
  assert.equal(rpg.start(game, ['1', '2'], { random: seeded(2) }).legal, true);
  assert.deepEqual([game.status, game.phase, game.roomIndex, game.partySize], ['playing', 'combat', 0, 2]);
  assert.equal(rpg.setClass(game, '1', 'guardian').reason, 'started');
  const four = startRun(['guardian', 'guardian', 'guardian', 'guardian']).game;
  assert.equal(four.partySize, 4);
});

// ---- movement --------------------------------------------------------------------------------

test('이동: 방향키 상태만 받고 대각선도 같은 속도, 벽·기둥·방 밖 통과 금지', () => {
  const { game } = startRun(['hunter']);
  const p = game.players['1'];
  game.mobs = []; game.spawns = []; game.delayed = [];
  const speed = p.d.speed;
  p.x = 0; p.z = 0;
  rpg.input(game, '1', { mv: rpg.MOVE_BITS.right });
  runTicks(game, 1);
  assert.ok(Math.abs(p.x - speed) < 0.05, `직선 ${p.x}`);
  p.x = 0; p.z = 0;
  rpg.input(game, '1', { mv: rpg.MOVE_BITS.right | rpg.MOVE_BITS.up });
  runTicks(game, 1);
  assert.ok(Math.abs(Math.hypot(p.x, p.z) - speed) < 0.05, '대각선이 더 빠르지 않다');
  assert.ok(p.z < 0 && p.x > 0, '↑는 화면 위(-z), →는 오른쪽(+x)');
  rpg.input(game, '1', { mv: rpg.MOVE_BITS.up });
  runTicks(game, 10);
  const b = game.room.layout.bounds;
  assert.ok(b.type === 'rect' ? p.z >= -b.h / 2 : Math.hypot(p.x, p.z) <= b.r, '방 밖으로 나가지 않는다');
  // Obstacles: walk straight into a pillar.
  game.room.layout = D.LAYOUTS.pillars;
  const pillar = D.LAYOUTS.pillars.obstacles[0];
  p.x = pillar.x - 3; p.z = pillar.z;
  rpg.input(game, '1', { mv: rpg.MOVE_BITS.right });
  runTicks(game, 2);
  assert.ok(Math.hypot(p.x - pillar.x, p.z - pillar.z) >= pillar.r + D.CLASSES.hunter.radius - 0.01, '기둥을 통과하지 못한다');
  rpg.input(game, '1', { mv: 99 });
  assert.equal(p.mv, 99 & 15, '비트 이외의 값은 무시');
});

test('대시: 이동 방향으로 짧게, 쿨타임과 짧은 무적', () => {
  const { game } = startRun(['guardian']);
  const p = game.players['1'];
  game.mobs = []; game.spawns = []; game.delayed = [];
  p.x = 0; p.z = 0;
  rpg.input(game, '1', { mv: rpg.MOVE_BITS.left });
  assert.equal(rpg.act(game, '1', 'dash').legal, true);
  assert.equal(rpg.act(game, '1', 'dash').reason, 'cooldown');
  rpg.input(game, '1', { mv: 0 });
  runTicks(game, D.BALANCE.dash.duration + 0.01);
  assert.ok(Math.abs(p.x + D.BALANCE.dash.distance) < 0.4, `대시 거리 ${p.x}`);
  rpg.input(game, '1', { mv: 0 });
  // i-frames: damage during the dash window is ignored.
  runTicks(game, 1.2);
  rpg.act(game, '1', 'dash');
  const hp = p.hp;
  assert.equal(rpg.hurtPlayer(game, p, 50), false);
  assert.equal(p.hp, hp);
});

// ---- combat & progression ------------------------------------------------------------------------

test('전투 판정은 서버 계산: 기본 공격·Q 스킬로 몬스터 HP 감소, 처치 시 파티 전원 경험치', () => {
  const { game } = startRun(['guardian', 'arcanist']);
  game.delayed = []; game.spawns = [];
  const g = game.players['1']; const a = game.players['2'];
  g.x = 0; g.z = 0; g.facing = 0; a.x = 0; a.z = 3; a.facing = 0;
  const mob = rpg.makeMob(game, 'grunt', 0, -1.5);
  const hp = mob.hp;
  rpg.input(game, '1', { mv: 0, atk: true });
  runTicks(game, 0.1);
  assert.ok(mob.hp < hp, '검 베기 적중');
  rpg.input(game, '1', { atk: false });
  game.mobs = game.mobs.filter(m => m !== mob);
  const far = rpg.makeMob(game, 'grunt', 0, -8);
  const farHp = far.hp;
  assert.equal(rpg.act(game, '2', 'q').legal, true);
  assert.equal(rpg.act(game, '2', 'q').reason, 'cooldown');
  runTicks(game, 1);
  assert.ok(far.hp < farHp || !game.mobs.includes(far), '화염구 적중');
  game.mobs.push(mob);
  const xpBefore = [g.xp + g.level * 1000, a.xp + a.level * 1000];
  while (game.mobs.includes(mob)) rpg.hitMob(game, g, mob, 999);
  assert.ok(g.xp + g.level * 1000 > xpBefore[0] && a.xp + a.level * 1000 > xpBefore[1], '처치 경험치는 모두에게');
  assert.equal(rpg.act(game, '1', 'w').reason, 'no-skill');
});

test('방 클리어 → 레벨업 후보 3개(서로 다름) → 선택·능력치·준비 → 다음 방', () => {
  const { game, seats } = startRun(['arcanist']);
  const p = game.players['1'];
  rpg.gainXp(game, p, 200);
  assert.ok(p.pendingLevels >= 2);
  assert.equal(p.choices, null, '전투 중에는 선택 UI를 띄우지 않는다');
  assert.equal(rpg.allocateStat(game, '1', 'int').reason, 'not-now');
  game.mobs = []; game.spawns = []; game.delayed = []; game.room.wave = game.room.waves.length - 1;
  rpg.tick(game);
  assert.equal(game.phase, 'intermission');
  assert.equal(game.room.cleared, true);
  assert.equal(p.choices.length, 3);
  assert.equal(new Set(p.choices.map(c => c.id)).size, 3);
  assert.equal(rpg.setReady(game, '1', true).reason, 'pending');
  const levels = p.pendingLevels;
  const first = p.choices[0];
  assert.equal(rpg.chooseLevelUp(game, '1', 0).legal, true);
  assert.equal(p.pendingLevels, levels - 1);
  if (first.type === 'skill') assert.ok(Object.values(p.skills).includes(first.id));
  while (p.choices) rpg.chooseLevelUp(game, '1', 0);
  const before = p.d.skillMul;
  assert.equal(rpg.allocateStat(game, '1', 'int').legal, true);
  assert.ok(p.d.skillMul > before, '지능은 스킬 피해');
  assert.equal(rpg.allocateStat(game, '1', 'charm').reason, 'bad-stat');
  assert.equal(rpg.setReady(game, '1', true).legal, true);
  assert.deepEqual([game.roomIndex, game.phase], [1, 'combat']);
  void seats;
});

test('스킬 진화: 새 스킬 습득 뒤 진화가 후보에 오르고, 선행 진화 없이는 상위 진화가 나오지 않는다', () => {
  const { game } = startRun(['arcanist']);
  const p = game.players['1'];
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    game.random = seeded(100 + i);
    p.pendingLevels = 1;
    game.phase = 'intermission';
    p.choices = null;
    const choices = rpgRoll(game, p);
    for (const c of choices) seen.add(c.id);
    assert.equal(choices.some(c => c.id === 'fireChain') && !p.mods.includes('fireBurn'), false, '연쇄 연소는 화상 이후');
  }
  assert.ok(seen.has('fireDamage') && seen.has('frostNova'), '화염구 진화와 새 스킬이 후보에 있다');
  p.mods.push('fireBurn');
  const s = rpg.skillStats(p, 'fireball');
  assert.equal(s.burn, true);
  p.mods.push('fireSplit', 'fireDamage');
  const evolved = rpg.skillStats(p, 'fireball');
  assert.equal(evolved.split, 3);
  assert.ok(Math.abs(evolved.damage - D.SKILLS.fireball.damage * 1.3) < 1e-9);
});

function rpgRoll(game, p) {
  // Level-up offers are produced by the engine when a room is cleared; replicate that entry point.
  game.mobs = []; game.spawns = []; game.delayed = [];
  p.choices = null;
  const engine = require('../lib/games/rpg/engine');
  engine.chooseLevelUp; // (public API only below)
  game.phase = 'combat'; game.room.wave = game.room.waves.length - 1;
  engine.tick(game);
  const choices = p.choices || [];
  // leave the room state as it was for the next roll
  game.phase = 'combat'; game.room.cleared = false;
  return choices;
}

test('아이템: 보물방에서 3개 중 선택(장신구 2칸), 효과가 전투에 반영', () => {
  const { game } = startRun(['hunter'], 3);
  const p = game.players['1'];
  rpg.enterRoom(game, 2); // treasure
  assert.equal(game.phase, 'intermission');
  assert.equal(p.itemChoices.length, 3);
  const potions = p.potions;
  assert.equal(rpg.chooseItem(game, '1', 'skip').legal, true);
  assert.equal(p.potions, potions + 1);
  // Equip specific items and check their effects.
  p.items.trinkets = ['thunderRing', 'berserkChain'];
  p.items.weapon = 'hunterEdge';
  rpg.derive(p);
  assert.ok(p.d.crit >= 0.05 + 0.1);
  assert.equal(p.d.e.critChain, 16);
  p.itemChoices = [{ id: 'luckyCoin', slot: 'trinket', name: 'x', rarity: 'common' }];
  rpg.chooseItem(game, '1', 0);
  assert.deepEqual(p.items.trinkets, ['berserkChain', 'luckyCoin'], '장신구는 두 칸, 가장 오래된 것부터 교체');
  // Thunder ring: a critical hit chains lightning to nearby enemies.
  p.items.trinkets = ['thunderRing']; rpg.derive(p); p.d.crit = 1;
  game.phase = 'combat';
  const a = rpg.makeMob(game, 'grunt', 0, 0); const b = rpg.makeMob(game, 'grunt', 1.5, 0);
  const bHp = b.hp;
  rpg.hitMob(game, p, a, 5, { source: 'basic' });
  assert.ok(b.hp < bHp, '번개의 반지 연쇄');
});

test('몬스터 AI: 추적·사거리·쿨타임 공격, 원거리 투사체, 광역 경고 후 피해, 사망', () => {
  const { game } = startRun(['guardian']);
  game.mobs = []; game.spawns = []; game.delayed = [];
  const p = game.players['1'];
  p.x = 0; p.z = 4;
  const grunt = rpg.makeMob(game, 'grunt', 0, -4);
  grunt.cd = 0;
  const start = Math.hypot(grunt.x - p.x, grunt.z - p.z);
  runTicks(game, 1);
  assert.ok(Math.hypot(grunt.x - p.x, grunt.z - p.z) < start, '추적');
  const hp = p.hp;
  runTicks(game, 3);
  assert.ok(p.hp < hp, '근접 공격');
  game.mobs = [];
  const caster = rpg.makeMob(game, 'caster', 0, -3); caster.cd = 0;
  p.hp = p.maxHp;
  runTicks(game, 0.2);
  const warn = game.hazards.find(h => h.owner === 'm');
  assert.ok(warn, '광역 공격 전 바닥 경고');
  assert.ok(warn.fireAt - game.time >= 0.8, '경고 시간 0.8초 이상');
  assert.equal(p.hp, p.maxHp, '경고 중에는 피해 없음');
  // Step out of the warned circle: no damage.
  p.x = warn.x + warn.r + 3; p.z = warn.z;
  runTicks(game, 1.2);
  assert.equal(p.hp, p.maxHp, '피하면 피해 없음');
  game.mobs = []; game.hazards = [];
  const archer = rpg.makeMob(game, 'archer', 0, -6); archer.cd = 0; p.x = 0; p.z = 3;
  runTicks(game, 1);
  assert.ok(game.projectiles.some(pr => pr.owner === 'm') || p.hp < p.maxHp, '원거리 투사체');
  rpg.hitMob(game, p, archer, 9999);
  assert.equal(game.mobs.includes(archer), false, '사망');
});

test('보스: 경고 후 패턴·HP 구간 강화·처치 시 원정 성공', () => {
  const { game } = startRun(['arcanist', 'guardian']);
  rpg.enterRoom(game, 7);
  assert.equal(game.room.kind, 'boss');
  runTicks(game, 3);
  const boss = game.mobs.find(m => m.boss);
  assert.ok(boss, '보스 등장');
  assert.equal(boss.maxHp, Math.round(D.MONSTERS.boss.hp * D.BALANCE.party.bossHp[1]));
  const kinds = new Set();
  for (let i = 0; i < 400 && kinds.size < 3; i += 1) { rpg.tick(game); for (const h of game.hazards) if (h.owner === 'm') kinds.add(h.kind); for (const p of Object.values(game.players)) { p.hp = p.maxHp; p.state = 'ok'; } }
  assert.ok(kinds.size >= 2, `보스 패턴 다양성 ${[...kinds]}`);
  const a = game.players['1'];
  rpg.hitMob(game, a, boss, boss.hp * 0.5);
  runTicks(game, 0.1);
  assert.ok(boss.phase >= 1, 'HP 구간 강화');
  assert.ok(game.spawns.length > 0 || game.mobs.some(m => !m.boss && !m.ally), '강화 시 소환');
  rpg.hitMob(game, a, boss, 99999);
  assert.deepEqual([game.status, game.phase, game.result.kind], ['finished', 'victory', 'clear']);
});

test('쓰러짐: 멀티는 곁에 선 동료가 부활, 전원 쓰러지면 실패 · 솔로는 부활 1회', () => {
  let { game } = startRun(['guardian', 'hunter']);
  game.mobs = []; game.spawns = []; game.delayed = [];
  const [a, b] = [game.players['1'], game.players['2']];
  a.x = 0; a.z = 0; b.x = 5; b.z = 0;
  rpg.hurtPlayer(game, a, 9999);
  assert.equal(a.state, 'down');
  assert.equal(rpg.act(game, '1', 'q').reason, 'down');
  runTicks(game, 3);
  assert.equal(a.state, 'down', '멀리 있으면 부활하지 않는다');
  b.x = 1; b.z = 0;
  runTicks(game, D.BALANCE.reviveSeconds + 0.3);
  assert.equal(a.state, 'ok');
  assert.ok(a.hp > 0);
  a.invulnUntil = 0; b.invulnUntil = 0;
  rpg.hurtPlayer(game, a, 9999); rpg.hurtPlayer(game, b, 9999);
  rpg.makeMob(game, 'grunt', 8, 8);
  rpg.tick(game);
  assert.deepEqual([game.status, game.result.kind], ['finished', 'defeat']);
  ({ game } = startRun(['arcanist']));
  const solo = game.players['1'];
  rpg.hurtPlayer(game, solo, 9999);
  runTicks(game, 2.2);
  assert.equal(solo.state, 'ok', '솔로 부활 1회');
  assert.equal(game.revivesLeft, 0);
  rpg.hurtPlayer(game, solo, 9999); solo.invulnUntil = 0; rpg.hurtPlayer(game, solo, 9999);
  runTicks(game, 2.5);
  assert.equal(game.result?.kind, 'defeat');
});

test('인원 보정: 인원이 늘면 몬스터 수가 늘고 한 마리 HP는 조금만 늘어난다', () => {
  const counts = {};
  const hps = {};
  for (const n of [1, 2, 3, 4]) {
    const { game } = startRun(Array(n).fill('hunter'), 11);
    runTicks(game, 1.05);
    counts[n] = game.spawns.length + game.mobs.length;
    runTicks(game, 2);
    hps[n] = game.mobs.find(m => m.type === 'grunt')?.maxHp;
  }
  assert.ok(counts[4] > counts[2] && counts[2] > counts[1], JSON.stringify(counts));
  assert.ok(hps[4] / hps[1] <= 1.3, `HP 배율 ${hps[4] / hps[1]}`);
});

test('스폰: 플레이어 바로 옆에 생기지 않고, 경고 표시 뒤에 나타난다', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const { game } = startRun(['guardian', 'hunter', 'arcanist'], seed);
    runTicks(game, 1.05);
    assert.ok(game.spawns.length > 0);
    for (const s of game.spawns) for (const p of Object.values(game.players)) assert.ok(Math.hypot(s.x - p.x, s.z - p.z) >= D.BALANCE.spawnMinDistance - 1e-6);
    assert.ok(game.spawns.every(s => s.at > game.time), '예고 후 등장');
  }
});

test('스냅숏은 작고(입력 주기와 무관) 위치·HP·경고만 담는다', () => {
  const { game } = startRun(['guardian', 'hunter', 'arcanist', 'arcanist']);
  runTicks(game, 4);
  const snap = rpg.snapshot(game);
  assert.ok(JSON.stringify(snap).length < 8000);
  assert.deepEqual(Object.keys(snap).sort(), ['fx', 'hz', 'm', 'mv', 'p', 'ph', 'pr', 'ri', 'sp', 't']);
  const view = rpg.publicState(game);
  assert.equal(view.players['1'].choices, null);
  assert.equal(view.rooms.length, 8);
});

test('전체 원정: 봇이 역할 조합별로 8개 방·보스까지 돌파한다(무작위 방·몬스터)', () => {
  const combos = [['guardian'], ['arcanist'], ['guardian', 'hunter'], ['hunter', 'arcanist', 'guardian'], ['guardian', 'hunter', 'arcanist', 'arcanist']];
  for (const classes of combos) {
    let cleared = 0;
    for (const seed of [1, 2, 3]) {
      const { game, seats } = startRun(classes, seed);
      const { maxMobs } = playOut(game, seats, { seed });
      assert.ok(maxMobs >= 6 + classes.length, `${classes} 다수 몬스터 ${maxMobs}`);
      if (game.result?.kind !== 'clear') continue;
      cleared += 1;
      for (const seat of seats) assert.ok(game.players[seat].level >= 4, `${classes} 레벨 ${game.players[seat].level}`);
    }
    assert.ok(cleared >= 1, `${classes.join('+')} 클리어 실패`);
  }
});
