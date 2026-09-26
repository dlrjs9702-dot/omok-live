'use strict';

// Balance and content data for the co-op 3D roguelike (v0.1 vertical slice). Everything a designer
// would tune lives here: classes, skills and their evolutions, passives, items, monsters, rooms,
// party-size scaling. The engine only interprets these tables. World units are metres; the camera
// looks from +z towards -z, so "screen up" is -z.

const TICK = 0.05; // server simulation step (20 Hz)

const BALANCE = {
  xpToNext: level => 18 + level * 14,
  statPointsPerLevel: 2,
  maxLevel: 30,
  dash: { distance: 6.5, duration: 0.18, cooldown: 1.1, invulnerable: 0.22 },
  critMultiplier: 1.75,
  armorK: 25, // damage taken × armorK / (armorK + armor)
  reviveSeconds: 2.5, // an ally standing next to a downed player
  reviveRange: 1.8,
  reviveHpShare: 0.4,
  // Party size 1..4 (index 0..3): more monsters and elites first, only a little more HP each.
  party: {
    mobCount: [1, 1.45, 1.9, 2.35],
    mobHp: [1, 1.08, 1.16, 1.24],
    eliteExtra: [0, 0, 1, 1],
    bossHp: [1, 1.55, 2.1, 2.6],
    bossExtraCircles: [0, 0, 1, 2],
  },
  solo: { regenPerSecond: 0.6, revives: 1, potionBonus: 1 },
  spawnMinDistance: 7, // never spawn a monster closer than this to a player
  spawnWarn: 0.9, // seconds a spawn marker shows before the monster appears
  intermissionTimeout: 120, // seconds before the party moves on without the slowest player
};

// Base stats: 힘 str (기본 공격·근접), 민첩 agi (공격속도·치명타), 지능 int (스킬 피해·쿨타임),
// 체력 vit (최대 HP·방어), 행운 luk (발동 확률·보상).
const STATS = ['str', 'agi', 'int', 'vit', 'luk'];

const CLASSES = {
  guardian: {
    name: '수호자', hp: 150, speed: 5.6, radius: 0.55, color: '#60a5fa',
    stats: { str: 6, agi: 3, int: 2, vit: 6, luk: 3 },
    basic: { kind: 'melee', name: '검 베기', damage: 13, interval: 0.55, range: 2.7, arc: 115 },
    q: 'shieldBash',
    learnable: ['whirlwind', 'charge', 'bulwark'],
  },
  hunter: {
    name: '사냥꾼', hp: 110, speed: 6.2, radius: 0.5, color: '#4ade80',
    stats: { str: 4, agi: 7, int: 3, vit: 3, luk: 4 },
    basic: { kind: 'projectile', name: '화살', damage: 10, interval: 0.42, speed: 24, range: 16, radius: 0.25, projectile: 'arrow' },
    q: 'pierceShot',
    learnable: ['multiShot', 'explosiveArrow', 'wolf'],
  },
  arcanist: {
    name: '비술사', hp: 95, speed: 5.8, radius: 0.5, color: '#c084fc',
    stats: { str: 2, agi: 4, int: 8, vit: 3, luk: 4 },
    basic: { kind: 'projectile', name: '마력탄', damage: 11, interval: 0.55, speed: 17, range: 14, radius: 0.3, projectile: 'bolt' },
    q: 'fireball',
    learnable: ['frostNova', 'chainLightning', 'meteor'],
  },
};

// Active skills. `mods` is the list of evolutions a level-up can grant (each once, in any order
// unless `requires` names another evolution of the same skill).
const SKILLS = {
  shieldBash: {
    name: '방패 강타', cls: 'guardian', cooldown: 5.5, kind: 'cone', damage: 24, range: 3.2, arc: 100, stun: 1.0, knockback: 2.5,
    mods: [
      { id: 'bashWide', name: '방패 강타: 넓은 강타', desc: '범위 +35%', effect: { rangeMul: 1.35, arcAdd: 40 } },
      { id: 'bashDamage', name: '방패 강타: 강화', desc: '피해 +35%', effect: { damageMul: 1.35 } },
      { id: 'bashShock', name: '방패 강타: 충격파', desc: '적중한 적 주위에 충격파', effect: { shockwave: 2.2 } },
    ],
  },
  whirlwind: {
    name: '회전베기', cls: 'guardian', cooldown: 7, kind: 'nova', damage: 20, radius: 3.0,
    mods: [
      { id: 'whirlRange', name: '회전베기: 범위', desc: '범위 +30%', effect: { radiusMul: 1.3 } },
      { id: 'whirlDamage', name: '회전베기: 피해', desc: '피해 +30%', effect: { damageMul: 1.3 } },
      { id: 'whirlTwice', name: '회전베기: 2회 회전', desc: '곧바로 한 번 더 회전', effect: { repeat: 1 } },
      { id: 'whirlKill', name: '회전베기: 처치 가속', desc: '회전베기로 처치하면 쿨타임 -1초', effect: { killCdr: 1 }, requires: 'whirlDamage' },
    ],
  },
  charge: {
    name: '돌진', cls: 'guardian', cooldown: 8, kind: 'charge', damage: 22, distance: 7, width: 1.6, stun: 0.6,
    mods: [
      { id: 'chargeFar', name: '돌진: 거리', desc: '거리 +40%', effect: { distanceMul: 1.4 } },
      { id: 'chargeQuake', name: '돌진: 착지 충격', desc: '도착 지점 원형 피해', effect: { endNova: 2.8 } },
    ],
  },
  bulwark: {
    name: '방패막기', cls: 'guardian', cooldown: 12, kind: 'shield', shield: 45, duration: 4, taunt: 9,
    mods: [
      { id: 'bulwarkParty', name: '방패막기: 파티 보호', desc: '주변 아군에게도 보호막 절반', effect: { partyShare: 0.5 } },
      { id: 'bulwarkCounter', name: '방패막기: 반사', desc: '보호막이 막은 피해의 50%를 반사', effect: { reflect: 0.5 } },
    ],
  },
  pierceShot: {
    name: '관통 사격', cls: 'hunter', cooldown: 5, kind: 'projectile', damage: 30, speed: 32, range: 20, radius: 0.35, pierce: 3, projectile: 'pierce',
    mods: [
      { id: 'pierceMore', name: '관통 사격: 관통 +3', desc: '관통 수 +3', effect: { pierceAdd: 3 } },
      { id: 'pierceRange', name: '관통 사격: 사거리', desc: '사거리 +40%', effect: { rangeMul: 1.4 } },
      { id: 'pierceStack', name: '관통 사격: 가속 관통', desc: '적을 관통할 때마다 피해 +25%', effect: { pierceGrow: 0.25 } },
      { id: 'pierceBoom', name: '관통 사격: 종착 폭발', desc: '마지막 지점에서 폭발', effect: { endExplode: 2.6 }, requires: 'pierceMore' },
    ],
  },
  multiShot: {
    name: '다중 사격', cls: 'hunter', cooldown: 6, kind: 'fan', damage: 11, count: 5, spread: 44, speed: 24, range: 14, radius: 0.25, projectile: 'arrow',
    mods: [
      { id: 'multiMore', name: '다중 사격: 화살 +3', desc: '화살 +3', effect: { countAdd: 3 } },
      { id: 'multiDamage', name: '다중 사격: 피해', desc: '피해 +30%', effect: { damageMul: 1.3 } },
    ],
  },
  explosiveArrow: {
    name: '폭발 화살', cls: 'hunter', cooldown: 7, kind: 'projectile', damage: 26, speed: 22, range: 15, radius: 0.35, explode: 2.6, projectile: 'bomb',
    mods: [
      { id: 'boomRadius', name: '폭발 화살: 범위', desc: '폭발 범위 +35%', effect: { explodeMul: 1.35 } },
      { id: 'boomBurn', name: '폭발 화살: 소각', desc: '폭발에 화상', effect: { burn: true } },
    ],
  },
  wolf: {
    name: '야수 호출', cls: 'hunter', cooldown: 14, kind: 'summon', summon: 'wolf', duration: 10, damage: 12,
    mods: [
      { id: 'wolfPack', name: '야수 호출: 무리', desc: '늑대 +1', effect: { countAdd: 1 } },
      { id: 'wolfCrit', name: '야수 호출: 사냥 본능', desc: '내 치명타 때 늑대가 대상에게 돌진', effect: { critLeap: true } },
    ],
  },
  fireball: {
    name: '화염구', cls: 'arcanist', cooldown: 4.5, kind: 'projectile', damage: 26, speed: 15, range: 15, radius: 0.45, explode: 2.2, projectile: 'fire', element: 'fire',
    mods: [
      { id: 'fireDamage', name: '화염구: 피해 +30%', desc: '피해 +30%', effect: { damageMul: 1.3 } },
      { id: 'fireBlast', name: '화염구: 대폭발', desc: '폭발 범위 +40%', effect: { explodeMul: 1.4 } },
      { id: 'fireBurn', name: '화염구: 화상', desc: '폭발에 휘말린 적에게 화상', effect: { burn: true } },
      { id: 'fireSplit', name: '화염구: 분열', desc: '3방향으로 발사', effect: { split: 3 } },
      { id: 'fireChain', name: '화염구: 연쇄 연소', desc: '화상 걸린 적이 죽으면 폭발해 주변에 화상', effect: { burnDeathBlast: 2.4 }, requires: 'fireBurn' },
    ],
  },
  frostNova: {
    name: '서리 폭발', cls: 'arcanist', cooldown: 8, kind: 'nova', damage: 14, radius: 4, slow: 0.5, slowTime: 2.5, element: 'frost',
    mods: [
      { id: 'frostFreeze', name: '서리 폭발: 빙결', desc: '이미 둔화된 적은 빙결', effect: { freeze: 1.6 } },
      { id: 'frostShard', name: '서리 폭발: 얼음 파편', desc: '빙결된 적이 죽으면 얼음 파편', effect: { shards: 6 }, requires: 'frostFreeze' },
      { id: 'frostRange', name: '서리 폭발: 한파', desc: '범위 +30%, 피해 +30%', effect: { radiusMul: 1.3, damageMul: 1.3 } },
    ],
  },
  chainLightning: {
    name: '연쇄 번개', cls: 'arcanist', cooldown: 5.5, kind: 'chain', damage: 22, range: 11, jumps: 3, jumpRange: 5.5, element: 'shock',
    mods: [
      { id: 'chainMore', name: '연쇄 번개: 연쇄 +3', desc: '연쇄 대상 +3', effect: { jumpsAdd: 3 } },
      { id: 'chainCrit', name: '연쇄 번개: 과부하', desc: '치명타 시 한 번 더 연쇄', effect: { critExtra: 1 } },
      { id: 'chainDamage', name: '연쇄 번개: 전압', desc: '피해 +30%', effect: { damageMul: 1.3 } },
    ],
  },
  meteor: {
    name: '유성 낙하', cls: 'arcanist', cooldown: 11, kind: 'meteor', damage: 55, radius: 3.4, delay: 0.8, range: 12, element: 'fire',
    mods: [
      { id: 'meteorTwin', name: '유성 낙하: 쌍유성', desc: '유성 하나 더', effect: { countAdd: 1 } },
      { id: 'meteorBurn', name: '유성 낙하: 불바다', desc: '낙하 지점 적에게 화상', effect: { burn: true } },
    ],
  },
};

// Passive picks. `cls` null = everyone. `max` = how many times the same passive may be taken.
const PASSIVES = [
  { id: 'atkSpeed', name: '공격속도 +15%', desc: '기본 공격이 빨라진다', max: 4, effect: { attackSpeed: 0.15 } },
  { id: 'maxHp', name: '최대 HP +25', desc: '튼튼해진다', max: 4, effect: { maxHp: 25 } },
  { id: 'armor', name: '방어 +8', desc: '받는 피해 감소', max: 4, effect: { armor: 8 } },
  { id: 'crit', name: '치명타 +8%', desc: '치명타 확률 증가', max: 4, effect: { crit: 0.08 } },
  { id: 'moveSpeed', name: '이동속도 +8%', desc: '더 빠르게 움직인다', max: 2, effect: { moveSpeed: 0.08 } },
  { id: 'vamp', name: '처치 회복', desc: '적 처치 시 HP 3 회복', max: 3, effect: { killHeal: 3 } },
  { id: 'skillHaste', name: '쿨타임 -10%', desc: '스킬 재사용 대기시간 감소', max: 3, effect: { cdr: 0.1 } },
  { id: 'counter', name: '반격', cls: 'guardian', desc: '피격 시 30% 확률로 반격 충격파', max: 1, effect: { counter: 0.3 } },
  { id: 'counterPower', name: '반격 강화', cls: 'guardian', desc: '반격 피해 +60%', max: 2, effect: { counterMul: 0.6 }, requires: 'counter' },
  { id: 'fury', name: '광폭화', cls: 'guardian', desc: 'HP 50% 이하일 때 피해 +30%', max: 1, effect: { lowHpDamage: 0.3 } },
  { id: 'pierceBasic', name: '관통 강화', cls: 'hunter', desc: '기본 화살이 적 1명 관통', max: 2, effect: { basicPierce: 1 } },
  { id: 'twinArrow', name: '연사', cls: 'hunter', desc: '기본 공격 3번마다 화살 2발', max: 1, effect: { twinEvery: 3 } },
  { id: 'ignite', name: '점화', cls: 'arcanist', desc: '마력탄이 화상을 입힌다', max: 1, effect: { basicBurn: true } },
  { id: 'chill', name: '냉기 마력', cls: 'arcanist', desc: '마력탄이 둔화를 건다', max: 1, effect: { basicSlow: true } },
  { id: 'arcPower', name: '비전 증폭', cls: 'arcanist', desc: '스킬 피해 +15%', max: 3, effect: { skillDamage: 0.15 } },
];

const RARITY = {
  common: { name: '일반', color: '#e5e7eb', weight: 50 },
  uncommon: { name: '고급', color: '#4ade80', weight: 28 },
  rare: { name: '희귀', color: '#60a5fa', weight: 15 },
  epic: { name: '영웅', color: '#c084fc', weight: 6 },
  legendary: { name: '전설', color: '#fbbf24', weight: 1.5 },
};

// Equipment: weapon, armor, trinket (two trinket slots). Effects are the point, numbers second.
const ITEMS = [
  { id: 'ironBlade', name: '단련된 무기', slot: 'weapon', rarity: 'common', stats: { str: 3 }, desc: '힘 +3' },
  { id: 'swiftGrip', name: '가벼운 손잡이', slot: 'weapon', rarity: 'common', stats: { agi: 3 }, desc: '민첩 +3' },
  { id: 'runeFocus', name: '룬 초점구', slot: 'weapon', rarity: 'uncommon', stats: { int: 4 }, desc: '지능 +4' },
  { id: 'hunterEdge', name: '사냥꾼의 날', slot: 'weapon', rarity: 'rare', stats: { agi: 3 }, effect: { crit: 0.1 }, desc: '민첩 +3 · 치명타 +10%' },
  { id: 'emberStaff', name: '불씨 지팡이', slot: 'weapon', rarity: 'epic', stats: { int: 4 }, effect: { basicBurn: true }, desc: '지능 +4 · 기본 공격에 화상' },
  { id: 'stormEye', name: '폭풍의 눈', slot: 'weapon', rarity: 'legendary', stats: { agi: 2, int: 2 }, effect: { novaEvery: 5 }, desc: '기본 공격 5번마다 주변에 번개 폭발' },
  { id: 'leatherVest', name: '질긴 가죽옷', slot: 'armor', rarity: 'common', stats: { vit: 3 }, desc: '체력 +3' },
  { id: 'plateMail', name: '판금 흉갑', slot: 'armor', rarity: 'uncommon', stats: { vit: 4 }, effect: { armor: 6 }, desc: '체력 +4 · 방어 +6' },
  { id: 'frozenHeart', name: '얼어붙은 심장', slot: 'armor', rarity: 'epic', stats: { vit: 3 }, effect: { hurtFrost: 0.3 }, desc: '피격 시 30% 확률로 주변 적 빙결' },
  { id: 'thornCoat', name: '가시 외투', slot: 'armor', rarity: 'rare', stats: { vit: 2 }, effect: { thorns: 0.4 }, desc: '받은 근접 피해의 40% 반사' },
  { id: 'luckyCoin', name: '행운의 동전', slot: 'trinket', rarity: 'common', stats: { luk: 4 }, desc: '행운 +4' },
  { id: 'vitalCharm', name: '생명 부적', slot: 'trinket', rarity: 'uncommon', stats: { vit: 2 }, effect: { maxHp: 20 }, desc: '최대 HP +20' },
  { id: 'thunderRing', name: '번개의 반지', slot: 'trinket', rarity: 'rare', effect: { critChain: 16 }, desc: '치명타 시 주변 적 2명에게 번개' },
  { id: 'berserkChain', name: '광전사의 목걸이', slot: 'trinket', rarity: 'rare', effect: { lowHpAttackSpeed: 0.4 }, desc: 'HP 30% 이하일 때 공격속도 +40%' },
  { id: 'emberCore', name: '화염 핵', slot: 'trinket', rarity: 'epic', effect: { burnDamage: 0.5, burnDeathBlast: 1.8 }, desc: '화상 피해 +50% · 화상 적 사망 시 작은 폭발' },
  { id: 'windBoots', name: '바람 장화', slot: 'trinket', rarity: 'uncommon', stats: { agi: 2 }, effect: { moveSpeed: 0.08, dashCdr: 0.25 }, desc: '이동속도 +8% · 대시 쿨타임 -25%' },
  { id: 'phoenixFeather', name: '불사조 깃털', slot: 'trinket', rarity: 'legendary', effect: { cheatDeath: 1 }, desc: '처음 쓰러질 때 한 번 HP 50%로 버틴다' },
];

const CONSUMABLES = {
  potion: { name: '회복 물약', desc: '최대 HP의 40% 회복', heal: 0.4 },
};

// Monsters. `ai` picks the behaviour; `xp` is shared by the whole party.
const MONSTERS = {
  grunt: { name: '진흙 병사', hp: 38, speed: 3.3, radius: 0.55, damage: 8, ai: 'melee', range: 1.3, windup: 0.35, cooldown: 1.2, xp: 4, color: '#a16207' },
  archer: { name: '가시 사수', hp: 30, speed: 3.0, radius: 0.5, damage: 7, ai: 'ranged', range: 9, keep: 6.5, windup: 0.45, cooldown: 1.9, projectileSpeed: 11, xp: 5, color: '#15803d' },
  charger: { name: '뿔 멧돼지', hp: 52, speed: 2.9, radius: 0.7, damage: 14, ai: 'charger', range: 9, windup: 0.75, cooldown: 3.2, chargeSpeed: 15, chargeDistance: 10, xp: 6, color: '#b45309' },
  caster: { name: '포자 주술사', hp: 40, speed: 2.6, radius: 0.5, damage: 15, ai: 'caster', range: 11, keep: 7, windup: 1.1, cooldown: 3.6, aoe: 2.2, xp: 6, color: '#7c3aed' },
  swarm: { name: '먼지 박쥐', hp: 13, speed: 5.0, radius: 0.35, damage: 4, ai: 'melee', range: 0.9, windup: 0.2, cooldown: 0.9, xp: 1.5, color: '#64748b' },
  brute: { name: '돌비늘 거인', hp: 280, speed: 2.4, radius: 1.1, damage: 22, ai: 'brute', range: 3.6, windup: 0.9, cooldown: 2.4, arc: 100, slamRadius: 4.2, slamEvery: 7, xp: 30, elite: true, color: '#475569' },
  wolf: { name: '늑대', hp: 1, speed: 7.5, radius: 0.45, damage: 12, ai: 'ally', range: 1.2, cooldown: 0.7, xp: 0, color: '#d6d3d1' },
  boss: {
    name: '잿불 군주 이그라', hp: 1500, speed: 3.0, radius: 1.6, damage: 18, ai: 'boss', range: 3.2, xp: 0, boss: true, color: '#dc2626',
    patterns: {
      swipe: { damage: 18, radius: 3.4, arc: 120, windup: 0.6 },
      breath: { damage: 30, radius: 10, arc: 50, windup: 1.2 },
      charge: { damage: 26, distance: 16, width: 2.4, windup: 1.0, speed: 20 },
      circles: { damage: 24, radius: 2.8, windup: 1.3, count: 3 },
      ring: { damage: 20, inner: 4, outer: 9, windup: 1.4 },
    },
    phases: [{ below: 0.6, summon: { swarm: 4 }, haste: 1.2 }, { below: 0.3, summon: { grunt: 2, swarm: 3 }, haste: 1.45, enrage: true }],
  },
};

// Room layouts. Bounds: rect {w, h} or circle {r}. Obstacles: circles (pillars) and boxes (walls).
const LAYOUTS = {
  arena: { name: '넓은 투기장', bounds: { type: 'rect', w: 26, h: 18 }, obstacles: [] },
  ring: { name: '원형 전투장', bounds: { type: 'circle', r: 12 }, obstacles: [] },
  pillars: { name: '기둥의 방', bounds: { type: 'rect', w: 26, h: 20 }, obstacles: [
    { type: 'circle', x: -6.5, z: -4, r: 1.1 }, { type: 'circle', x: 6.5, z: -4, r: 1.1 },
    { type: 'circle', x: -6.5, z: 4, r: 1.1 }, { type: 'circle', x: 6.5, z: 4, r: 1.1 }] },
  gate: { name: '좁은 입구', bounds: { type: 'rect', w: 28, h: 22 }, obstacles: [
    { type: 'box', x: -8.5, z: 5, w: 11, d: 1.2 }, { type: 'box', x: 8.5, z: 5, w: 11, d: 1.2 }] },
  core: { name: '중앙 제단', bounds: { type: 'rect', w: 26, h: 20 }, obstacles: [{ type: 'box', x: 0, z: -1, w: 4.5, d: 4.5 }] },
  vault: { name: '보물고', bounds: { type: 'rect', w: 16, h: 12 }, obstacles: [] },
  throne: { name: '잿불 왕좌', bounds: { type: 'circle', r: 14 }, obstacles: [
    { type: 'circle', x: -9, z: -6, r: 1 }, { type: 'circle', x: 9, z: -6, r: 1 }] },
};

// Monster groups per wave (before party scaling). `count` is scaled by party size; elites are not.
const ENCOUNTERS = {
  easy: [{ grunt: 4, swarm: 4 }, { grunt: 3, archer: 2 }],
  mixed: [{ grunt: 3, archer: 2, swarm: 4 }, { charger: 2, caster: 1, grunt: 2 }],
  elite: [{ grunt: 3, archer: 2 }, { brute: 1, swarm: 5 }],
  hard: [{ charger: 2, archer: 3, swarm: 5 }, { caster: 2, grunt: 4 }, { brute: 1, charger: 1, swarm: 4 }],
};

// v0.1: one region, fixed order (branching is a later patch). Combat layouts are drawn at random.
const REGION = {
  name: '잿빛 협곡',
  rooms: [
    { kind: 'combat', encounter: 'easy', layouts: ['arena', 'ring'] },
    { kind: 'combat', encounter: 'mixed', layouts: ['pillars', 'core'] },
    { kind: 'treasure', layouts: ['vault'], rarityBoost: 0 },
    { kind: 'elite', encounter: 'elite', layouts: ['gate', 'arena'] },
    { kind: 'combat', encounter: 'mixed', layouts: ['ring', 'pillars', 'core'] },
    { kind: 'treasure', layouts: ['vault'], rarityBoost: 1 },
    { kind: 'combat', encounter: 'hard', layouts: ['gate', 'core'], label: '강화 전투' },
    { kind: 'boss', layouts: ['throne'] },
  ],
};

const ROOM_KIND_NAME = { combat: '전투', elite: '정예', treasure: '보물', boss: '보스' };

module.exports = { TICK, BALANCE, STATS, CLASSES, SKILLS, PASSIVES, RARITY, ITEMS, CONSUMABLES, MONSTERS, LAYOUTS, ENCOUNTERS, REGION, ROOM_KIND_NAME };
