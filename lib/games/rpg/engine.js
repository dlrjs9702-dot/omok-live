'use strict';

// Co-op 3D roguelike engine (server authoritative). Clients only send intents: held movement keys,
// held basic attack, skill/dash/item presses and between-room choices. Positions, collisions,
// cooldowns, damage, monster HP, XP, levels and drops are decided here. Everything in this game is
// shared information for the party, so the snapshots carry no per-player secrets.

const D = require('./data');

const { TICK, BALANCE } = D;
const SEATS = ['1', '2', '3', '4'];
const MOVE_BITS = { up: 1, down: 2, left: 4, right: 8 };
const SLOT_KEYS = ['q', 'w', 'e', 'r'];

// ---- small math helpers -------------------------------------------------------------------

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const dist = (a, b) => Math.sqrt(dist2(a, b));
const round2 = v => Math.round(v * 100) / 100;
function norm(x, z) { const l = Math.hypot(x, z); return l > 1e-6 ? { x: x / l, z: z / l } : { x: 0, z: 0 }; }
function angleOf(x, z) { return Math.atan2(x, -z); } // 0 = screen up (-z), clockwise positive
function dirOf(a) { return { x: Math.sin(a), z: -Math.cos(a) }; }
function angleDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); }
function inCone(origin, facing, target, range, arcDeg, pad = 0) {
  const d = Math.hypot(target.x - origin.x, target.z - origin.z);
  if (d > range + pad) return false;
  if (d < 0.3) return true;
  return angleDiff(angleOf(target.x - origin.x, target.z - origin.z), facing) <= (arcDeg * Math.PI / 360) + Math.atan2(pad, Math.max(d, 0.1));
}
function segmentDistance(p, a, b) {
  const abx = b.x - a.x; const abz = b.z - a.z;
  const t = clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / (abx * abx + abz * abz || 1), 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}

// ---- collision --------------------------------------------------------------------------

function resolveCollision(layout, e, radius) {
  const b = layout.bounds;
  if (b.type === 'rect') {
    e.x = clamp(e.x, -b.w / 2 + radius, b.w / 2 - radius);
    e.z = clamp(e.z, -b.h / 2 + radius, b.h / 2 - radius);
  } else {
    const l = Math.hypot(e.x, e.z); const max = b.r - radius;
    if (l > max) { e.x = e.x / l * max; e.z = e.z / l * max; }
  }
  for (const o of layout.obstacles) {
    if (o.type === 'circle') {
      const dx = e.x - o.x; const dz = e.z - o.z; const l = Math.hypot(dx, dz); const min = o.r + radius;
      if (l < min) { const n = l > 1e-6 ? { x: dx / l, z: dz / l } : { x: 0, z: 1 }; e.x = o.x + n.x * min; e.z = o.z + n.z * min; }
    } else {
      const hx = o.w / 2; const hz = o.d / 2;
      const cx = clamp(e.x, o.x - hx, o.x + hx); const cz = clamp(e.z, o.z - hz, o.z + hz);
      const dx = e.x - cx; const dz = e.z - cz; const l = Math.hypot(dx, dz);
      if (l < radius) {
        if (l > 1e-6) { e.x = cx + dx / l * radius; e.z = cz + dz / l * radius; } else {
          // centre inside the box: push out along the shallowest axis
          const px = hx + radius - Math.abs(e.x - o.x); const pz = hz + radius - Math.abs(e.z - o.z);
          if (px < pz) e.x += Math.sign(e.x - o.x || 1) * px; else e.z += Math.sign(e.z - o.z || 1) * pz;
        }
      }
    }
  }
}

function blocked(layout, x, z, radius = 0) {
  const b = layout.bounds;
  if (b.type === 'rect' ? (Math.abs(x) > b.w / 2 - radius || Math.abs(z) > b.h / 2 - radius) : Math.hypot(x, z) > b.r - radius) return true;
  for (const o of layout.obstacles) {
    if (o.type === 'circle' ? Math.hypot(x - o.x, z - o.z) < o.r + radius : (Math.abs(x - o.x) < o.w / 2 + radius && Math.abs(z - o.z) < o.d / 2 + radius)) return true;
  }
  return false;
}

// ---- state --------------------------------------------------------------------------------

function create() {
  return {
    status: 'selecting', phase: 'lobby', round: 1, time: 0, nextId: 1, metaVersion: 1,
    classes: {}, seatOrder: [], players: {}, mobs: [], projectiles: [], hazards: [], spawns: [], delayed: [], fx: [],
    roomIndex: -1, room: null, result: null, revivesLeft: 0, partySize: 0, intermissionUntil: null,
  };
}

function reset(game) {
  const keep = { classes: { ...game.classes }, round: (game.round || 1) + 1 };
  for (const key of Object.keys(game)) delete game[key];
  Object.assign(game, create(), keep);
}

function dirty(game) { game.metaVersion += 1; }
function id(game) { const v = game.nextId; game.nextId += 1; return v; }
function rand(game) { return (game.random || Math.random)(); }
function pick(game, list) { return list[Math.floor(rand(game) * list.length)]; }
function emit(game, event) { game.fx.push(event); }

function setClass(game, seat, cls) {
  if (game.status !== 'selecting') return { legal: false, reason: 'started' };
  if (!D.CLASSES[cls]) return { legal: false, reason: 'bad-class' };
  game.classes[String(seat)] = cls;
  dirty(game);
  return { legal: true };
}

function newPlayer(seat, cls) {
  const c = D.CLASSES[cls];
  return {
    seat, cls, x: 0, z: 0, facing: 0, hp: c.hp, maxHp: c.hp, shield: 0, shieldUntil: 0, shieldReflect: 0,
    state: 'ok', reviveProgress: 0, mv: 0, atk: false, dashUntil: 0, dashVx: 0, dashVz: 0, invulnUntil: 0, stunUntil: 0,
    dashLeft: 0, cds: { basic: 0, dash: 0, q: 0, w: 0, e: 0, r: 0 }, level: 1, xp: 0,
    alloc: { str: 0, agi: 0, int: 0, vit: 0, luk: 0 }, statPoints: 0,
    skills: { q: c.q, w: null, e: null, r: null }, mods: [], passives: {},
    items: { weapon: null, armor: null, trinkets: [] }, potions: 1,
    pendingLevels: 0, choices: null, itemChoices: null, ready: false, target: null, basicCount: 0, cheatDeathUsed: false,
    charge: null, d: null,
  };
}

function start(game, seats, { random } = {}) {
  if (game.status !== 'selecting') return { legal: false, reason: 'started' };
  const order = [...new Set(seats.map(String))].filter(s => SEATS.includes(s)).sort();
  if (order.length < 1 || order.length > 4) return { legal: false, reason: 'player-count' };
  if (order.some(seat => !D.CLASSES[game.classes[seat]])) return { legal: false, reason: 'no-class' };
  if (random) game.random = random;
  game.seatOrder = order;
  game.partySize = order.length;
  game.players = Object.fromEntries(order.map(seat => [seat, newPlayer(seat, game.classes[seat])]));
  for (const p of Object.values(game.players)) derive(p);
  for (const p of Object.values(game.players)) p.hp = p.maxHp;
  game.revivesLeft = order.length === 1 ? BALANCE.solo.revives : 0;
  if (order.length === 1) game.players[order[0]].potions += BALANCE.solo.potionBonus;
  game.status = 'playing';
  game.result = null;
  enterRoom(game, 0);
  return { legal: true };
}

// ---- derived stats ------------------------------------------------------------------------

function effectSum(p) {
  const total = {};
  const add = (effect, times = 1) => {
    for (const [key, value] of Object.entries(effect || {})) {
      if (typeof value === 'number') total[key] = (total[key] || 0) + value * times;
      else if (value) total[key] = value;
    }
  };
  for (const [pid, count] of Object.entries(p.passives)) add(D.PASSIVES.find(x => x.id === pid)?.effect, count);
  for (const item of [p.items.weapon, p.items.armor, ...p.items.trinkets]) if (item) add(itemDef(item)?.effect);
  return total;
}

function itemDef(itemId) { return D.ITEMS.find(item => item.id === itemId) || null; }

function derive(p) {
  const c = D.CLASSES[p.cls];
  const stats = {};
  for (const key of D.STATS) stats[key] = c.stats[key] + p.alloc[key];
  for (const item of [p.items.weapon, p.items.armor, ...p.items.trinkets]) for (const [k, v] of Object.entries(itemDef(item)?.stats || {})) stats[k] += v;
  const e = effectSum(p);
  const oldMax = p.maxHp || c.hp;
  const maxHp = Math.round(c.hp + stats.vit * 6 + (p.level - 1) * 4 + (e.maxHp || 0));
  p.d = {
    stats, e, maxHp,
    armor: stats.vit * 0.6 + (e.armor || 0),
    attackSpeed: 1 + stats.agi * 0.015 + (e.attackSpeed || 0),
    crit: Math.min(0.75, 0.05 + stats.agi * 0.008 + stats.luk * 0.004 + (e.crit || 0)),
    speed: c.speed * (1 + (e.moveSpeed || 0)),
    cdr: Math.min(0.5, stats.int * 0.01 + (e.cdr || 0)),
    basicMul: 1 + stats.str * 0.05,
    skillMul: 1 + stats.int * 0.05 + (e.skillDamage || 0),
    luck: 1 + stats.luk * 0.03,
  };
  p.maxHp = maxHp;
  if (p.hp > 0 && maxHp > oldMax) p.hp += maxHp - oldMax; // growth heals by the added amount
  p.hp = Math.min(p.hp, maxHp);
}

function skillDef(skillId) { return D.SKILLS[skillId] || null; }
// Base skill data with every evolution this player took applied.
function skillStats(p, skillId) {
  const base = { ...skillDef(skillId) };
  for (const mod of base.mods || []) {
    if (!p.mods.includes(mod.id)) continue;
    for (const [key, value] of Object.entries(mod.effect)) {
      if (key.endsWith('Mul')) { const field = key.slice(0, -3); base[field] = (base[field] || 0) * value; } else if (key.endsWith('Add')) { const field = key.slice(0, -3); base[field] = (base[field] || 0) + value; } else base[key] = value;
    }
  }
  return base;
}

// ---- rooms ----------------------------------------------------------------------------------

function layoutOf(game) { return game.room.layout; }

function playerSpawns(layout, count) {
  const b = layout.bounds;
  const z = b.type === 'rect' ? b.h / 2 - 2 : b.r - 2.5;
  return Array.from({ length: count }, (_, i) => ({ x: (i - (count - 1) / 2) * 1.8, z }));
}

function enterRoom(game, index) {
  const spec = D.REGION.rooms[index];
  const layoutId = pick(game, spec.layouts);
  const layout = D.LAYOUTS[layoutId];
  game.roomIndex = index;
  game.room = { index, kind: spec.kind, label: spec.label || D.ROOM_KIND_NAME[spec.kind], layoutId, layout, encounter: spec.encounter || null,
    wave: -1, waves: [], cleared: false, startedAt: game.time, rarityBoost: spec.rarityBoost || 0, chest: spec.kind === 'treasure' };
  game.mobs = []; game.projectiles = []; game.hazards = []; game.spawns = []; game.delayed = [];
  const spots = playerSpawns(layout, game.seatOrder.length);
  game.seatOrder.forEach((seat, i) => {
    const p = game.players[seat];
    Object.assign(p, { x: spots[i].x, z: spots[i].z, facing: 0, ready: false, dashUntil: 0, dashLeft: 0, charge: null, target: null, stunUntil: 0 });
  });
  if (spec.kind === 'treasure') {
    game.phase = 'intermission';
    beginIntermission(game, { items: true });
  } else {
    game.phase = 'combat';
    const waves = spec.kind === 'boss' ? [{ boss: 1 }] : D.ENCOUNTERS[spec.encounter];
    game.room.waves = waves;
    game.delayed.push({ at: game.time + 1.0, fn: 'wave' });
  }
  dirty(game);
}

function spawnPoint(game, near = null) {
  const layout = layoutOf(game);
  const b = layout.bounds;
  const alive = Object.values(game.players);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    let x; let z;
    if (near) { x = near.x + (rand(game) - 0.5) * 3; z = near.z + (rand(game) - 0.5) * 3; } else if (b.type === 'rect') { x = (rand(game) - 0.5) * (b.w - 3); z = -b.h / 2 + 1.5 + rand(game) * (b.h * 0.55); } else {
      const a = (rand(game) - 0.5) * Math.PI * 1.3; const r = 3 + rand(game) * (b.r - 4.5); x = Math.sin(a) * r; z = -Math.cos(a) * r;
    }
    if (blocked(layout, x, z, 1)) continue;
    if (alive.some(p => Math.hypot(p.x - x, p.z - z) < BALANCE.spawnMinDistance)) continue;
    return { x, z };
  }
  return { x: 0, z: b.type === 'rect' ? -b.h / 2 + 2 : -b.r + 2.5 };
}

function spawnWave(game) {
  const room = game.room;
  room.wave += 1;
  const wave = room.waves[room.wave];
  if (!wave) return;
  const n = game.partySize - 1;
  const groups = [];
  for (const [type, base] of Object.entries(wave)) {
    if (type === 'boss') { groups.push({ type: 'boss', count: 1 }); continue; }
    const def = D.MONSTERS[type];
    const count = def.elite ? base + (room.kind !== 'combat' ? BALANCE.party.eliteExtra[n] : 0) : Math.max(1, Math.round(base * BALANCE.party.mobCount[n]));
    groups.push({ type, count });
  }
  for (const { type, count } of groups) {
    if (type === 'boss') { game.spawns.push({ type, x: 0, z: -4, at: game.time + 1.6 }); continue; }
    const cluster = type === 'swarm' ? spawnPoint(game) : null;
    for (let i = 0; i < count; i += 1) {
      const at = cluster ? spawnPoint(game, cluster) : spawnPoint(game);
      game.spawns.push({ type, x: at.x, z: at.z, at: game.time + BALANCE.spawnWarn + i * 0.08 });
    }
  }
  dirty(game);
}

function makeMob(game, type, x, z, extra = {}) {
  const def = D.MONSTERS[type];
  const n = game.partySize - 1;
  const hpMul = def.boss ? BALANCE.party.bossHp[n] : def.ally ? 1 : BALANCE.party.mobHp[n] * (1 + game.roomIndex * 0.06);
  const hp = Math.round(def.hp * hpMul);
  const mob = { id: id(game), type, x, z, radius: def.radius, facing: Math.PI, hp, maxHp: hp, state: 'idle', stateUntil: 0, cd: game.time + 0.6 + rand(game) * 0.8,
    target: null, retargetAt: 0, slowUntil: 0, slowF: 1, frozenUntil: 0, stunUntil: 0, burn: null, tauntSeat: null, tauntUntil: 0,
    elite: Boolean(def.elite), boss: Boolean(def.boss), ally: def.ai === 'ally', phase: 0, slamAt: game.time + (def.slamEvery || 0), ...extra };
  game.mobs.push(mob);
  return mob;
}

function hostiles(game) { return game.mobs.filter(m => !m.ally && m.hp > 0); }

function checkRoomProgress(game) {
  if (game.phase !== 'combat') return;
  if (hostiles(game).length || game.spawns.length || game.delayed.some(d => d.fn === 'wave')) return;
  const room = game.room;
  if (room.wave + 1 < room.waves.length) { game.delayed.push({ at: game.time + 0.8, fn: 'wave' }); return; }
  if (room.kind === 'boss') return victory(game);
  clearRoom(game);
}

function clearRoom(game) {
  game.room.cleared = true;
  game.mobs = game.mobs.filter(m => m.ally && m.hp > 0);
  game.projectiles = []; game.hazards = []; game.spawns = [];
  for (const p of Object.values(game.players)) {
    if (p.state === 'down') { p.state = 'ok'; p.hp = Math.round(p.maxHp * 0.3); emit(game, { k: 'revive', s: p.seat }); }
  }
  emit(game, { k: 'clear' });
  game.phase = 'intermission';
  beginIntermission(game, { items: game.room.kind === 'elite' });
  dirty(game);
}

function beginIntermission(game, { items }) {
  game.intermissionUntil = game.time + BALANCE.intermissionTimeout;
  for (const p of Object.values(game.players)) {
    p.ready = false;
    if (p.pendingLevels > 0 && !p.choices) p.choices = rollChoices(game, p);
    if (items) p.itemChoices = rollItems(game, p, game.room.rarityBoost + (game.room.kind === 'elite' ? 1 : 0));
    if (game.room.kind === 'treasure') p.potions = Math.min(9, p.potions + 1);
  }
  dirty(game);
}

function victory(game) {
  game.phase = 'victory';
  game.status = 'finished';
  game.mobs = []; game.hazards = []; game.projectiles = []; game.spawns = [];
  game.result = { kind: 'clear', time: Math.round(game.time), rooms: game.roomIndex + 1, levels: Object.fromEntries(game.seatOrder.map(s => [s, game.players[s].level])) };
  emit(game, { k: 'victory' });
  dirty(game);
}

function defeat(game, reason = 'wipe') {
  game.phase = 'defeat';
  game.status = 'finished';
  game.result = { kind: 'defeat', reason, time: Math.round(game.time), rooms: game.roomIndex + 1, levels: Object.fromEntries(game.seatOrder.map(s => [s, game.players[s].level])) };
  emit(game, { k: 'defeat' });
  dirty(game);
}

// ---- level-up choices and items ------------------------------------------------------------

function rollChoices(game, p) {
  const cls = D.CLASSES[p.cls];
  const pool = [];
  const owned = SLOT_KEYS.map(k => p.skills[k]).filter(Boolean);
  const freeSlot = SLOT_KEYS.some(k => !p.skills[k]);
  if (freeSlot) for (const sk of cls.learnable) if (!owned.includes(sk)) pool.push({ type: 'skill', id: sk, weight: 3 });
  for (const sk of owned) {
    for (const mod of skillDef(sk).mods || []) {
      if (p.mods.includes(mod.id) || (mod.requires && !p.mods.includes(mod.requires))) continue;
      pool.push({ type: 'mod', skill: sk, id: mod.id, weight: 2.5 });
    }
  }
  for (const passive of D.PASSIVES) {
    if (passive.cls && passive.cls !== p.cls) continue;
    if ((p.passives[passive.id] || 0) >= passive.max) continue;
    if (passive.requires && !p.passives[passive.requires]) continue;
    pool.push({ type: 'passive', id: passive.id, weight: passive.cls ? 1.8 : 1.3 });
  }
  const chosen = [];
  while (chosen.length < 3 && pool.length) {
    const total = pool.reduce((sum, o) => sum + o.weight, 0);
    let r = rand(game) * total;
    let index = 0;
    for (; index < pool.length - 1; index += 1) { r -= pool[index].weight; if (r <= 0) break; }
    const [option] = pool.splice(index, 1);
    chosen.push(describeChoice(option));
  }
  return chosen;
}

function describeChoice(option) {
  if (option.type === 'skill') { const s = skillDef(option.id); return { type: 'skill', id: option.id, name: `새 스킬: ${s.name}`, desc: skillSummary(option.id) }; }
  if (option.type === 'mod') { const mod = skillDef(option.skill).mods.find(m => m.id === option.id); return { type: 'mod', skill: option.skill, id: option.id, name: mod.name, desc: mod.desc }; }
  const passive = D.PASSIVES.find(x => x.id === option.id);
  return { type: 'passive', id: option.id, name: passive.name, desc: passive.desc };
}

function skillSummary(skillId) {
  const s = skillDef(skillId);
  const text = { cone: '전방 강타', nova: '주변 범위 공격', charge: '전방 돌진 공격', shield: '보호막과 도발', projectile: '투사체', fan: '부채꼴 다발 사격', summon: '늑대 소환', chain: '연쇄 공격', meteor: '지연 광역 폭격' }[s.kind] || '';
  return `${text} · 쿨타임 ${s.cooldown}초`;
}

function rollItems(game, p, boost = 0) {
  const luck = p.d?.luck || 1;
  const weights = Object.entries(D.RARITY).map(([key, r], i) => [key, r.weight * (i >= 2 ? luck * (1 + boost * 0.8) : 1)]);
  const owned = new Set([p.items.weapon, p.items.armor, ...p.items.trinkets].filter(Boolean));
  const out = [];
  for (let guard = 0; out.length < 3 && guard < 50; guard += 1) {
    const total = weights.reduce((sum, [, w]) => sum + w, 0);
    let r = rand(game) * total; let rarity = weights[0][0];
    for (const [key, w] of weights) { r -= w; if (r <= 0) { rarity = key; break; } }
    const candidates = D.ITEMS.filter(item => item.rarity === rarity && !owned.has(item.id) && !out.some(o => o.id === item.id));
    if (!candidates.length) continue;
    const item = pick(game, candidates);
    out.push({ id: item.id, name: item.name, slot: item.slot, rarity: item.rarity, desc: item.desc });
  }
  return out;
}

function chooseLevelUp(game, seat, index) {
  const p = game.players[String(seat)];
  if (!p || game.phase !== 'intermission') return { legal: false, reason: 'not-now' };
  const option = p.choices?.[Number(index)];
  if (!option) return { legal: false, reason: 'bad-choice' };
  if (option.type === 'skill') {
    const slot = SLOT_KEYS.find(k => !p.skills[k]);
    if (!slot) return { legal: false, reason: 'no-slot' };
    p.skills[slot] = option.id;
  } else if (option.type === 'mod') p.mods.push(option.id);
  else p.passives[option.id] = (p.passives[option.id] || 0) + 1;
  p.pendingLevels -= 1;
  p.choices = p.pendingLevels > 0 ? rollChoices(game, p) : null;
  derive(p);
  emit(game, { k: 'pick', s: p.seat, name: option.name });
  dirty(game);
  return { legal: true };
}

function allocateStat(game, seat, stat) {
  const p = game.players[String(seat)];
  if (!p || game.status !== 'playing') return { legal: false, reason: 'not-now' };
  if (!D.STATS.includes(stat)) return { legal: false, reason: 'bad-stat' };
  if (p.statPoints <= 0) return { legal: false, reason: 'no-points' };
  if (game.phase !== 'intermission') return { legal: false, reason: 'not-now' };
  p.statPoints -= 1;
  p.alloc[stat] += 1;
  derive(p);
  dirty(game);
  return { legal: true };
}

function chooseItem(game, seat, index) {
  const p = game.players[String(seat)];
  if (!p || game.phase !== 'intermission' || !p.itemChoices) return { legal: false, reason: 'not-now' };
  if (index === 'skip') { p.itemChoices = null; p.potions = Math.min(9, p.potions + 1); dirty(game); return { legal: true }; }
  const option = p.itemChoices[Number(index)];
  if (!option) return { legal: false, reason: 'bad-choice' };
  if (option.slot === 'trinket') { p.items.trinkets.push(option.id); if (p.items.trinkets.length > 2) p.items.trinkets.shift(); } else p.items[option.slot] = option.id;
  p.itemChoices = null;
  derive(p);
  emit(game, { k: 'item', s: p.seat, name: option.name, rarity: option.rarity });
  dirty(game);
  return { legal: true };
}

function setReady(game, seat, ready) {
  const p = game.players[String(seat)];
  if (!p || game.phase !== 'intermission') return { legal: false, reason: 'not-now' };
  if (ready && (p.choices || p.itemChoices)) return { legal: false, reason: 'pending' };
  p.ready = Boolean(ready);
  dirty(game);
  if (Object.values(game.players).every(x => x.ready)) advance(game);
  return { legal: true };
}

function advance(game) {
  // Anything still undecided (timeout) is resolved with the first option.
  for (const p of Object.values(game.players)) {
    while (p.choices) chooseLevelUp(game, p.seat, 0);
    if (p.itemChoices) chooseItem(game, p.seat, 0);
  }
  if (game.roomIndex + 1 >= D.REGION.rooms.length) return victory(game);
  enterRoom(game, game.roomIndex + 1);
}

// ---- intents -----------------------------------------------------------------------------

function input(game, seat, { mv = 0, atk = false } = {}) {
  const p = game.players[String(seat)];
  if (!p || game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  p.mv = Number(mv) & 15;
  p.atk = Boolean(atk);
  return { legal: true };
}

function releaseInput(game, seat) {
  const p = game.players[String(seat)];
  if (p) { p.mv = 0; p.atk = false; }
}

function act(game, seat, action) {
  const p = game.players[String(seat)];
  if (!p || game.status !== 'playing') return { legal: false, reason: 'not-playing' };
  if (p.state !== 'ok') return { legal: false, reason: 'down' };
  if (action === 'dash') return dash(game, p);
  if (SLOT_KEYS.includes(action)) return castSkill(game, p, action);
  if (action === 'tab') return cycleTarget(game, p);
  if (/^item[1-4]$/.test(action)) return useItem(game, p, Number(action.slice(4)));
  return { legal: false, reason: 'bad-action' };
}

function moveDir(p) {
  const x = ((p.mv & MOVE_BITS.right) ? 1 : 0) - ((p.mv & MOVE_BITS.left) ? 1 : 0);
  const z = ((p.mv & MOVE_BITS.down) ? 1 : 0) - ((p.mv & MOVE_BITS.up) ? 1 : 0);
  return norm(x, z); // normalised: diagonal movement is not faster
}

function dash(game, p) {
  if (game.time < p.cds.dash || game.time < p.stunUntil || p.charge || p.dashLeft > 0) return { legal: false, reason: 'cooldown' };
  const dir = p.mv ? moveDir(p) : dirOf(p.facing);
  const speed = BALANCE.dash.distance / BALANCE.dash.duration;
  p.dashVx = dir.x * speed; p.dashVz = dir.z * speed;
  p.dashLeft = BALANCE.dash.distance; // distance based, so the tick size cannot shorten a dash
  p.dashUntil = game.time + BALANCE.dash.duration + TICK;
  p.invulnUntil = game.time + BALANCE.dash.invulnerable;
  p.cds.dash = game.time + BALANCE.dash.cooldown * (1 - (p.d.e.dashCdr || 0));
  p.facing = angleOf(dir.x, dir.z);
  emit(game, { k: 'dash', s: p.seat });
  return { legal: true };
}

function cycleTarget(game, p) {
  const list = hostiles(game).sort((a, b) => dist2(a, p) - dist2(b, p)).slice(0, 6);
  if (!list.length) { p.target = null; return { legal: true }; }
  const at = list.findIndex(m => m.id === p.target);
  p.target = list[(at + 1) % list.length].id;
  return { legal: true };
}

function useItem(game, p, slot) {
  if (slot !== 1 || p.potions <= 0) return { legal: false, reason: 'no-item' };
  if (p.hp >= p.maxHp) return { legal: false, reason: 'full' };
  p.potions -= 1;
  heal(game, p, p.maxHp * D.CONSUMABLES.potion.heal);
  dirty(game);
  return { legal: true };
}

function heal(game, p, amount) {
  if (p.state !== 'ok') return;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amount);
  if (p.hp - before >= 1) emit(game, { k: 'heal', x: round2(p.x), z: round2(p.z), v: Math.round(p.hp - before) });
}

// Aim: locked target, else the nearest enemy roughly in front, else straight ahead.
function aim(game, p, range) {
  const locked = p.target ? game.mobs.find(m => m.id === p.target && m.hp > 0 && !m.ally) : null;
  if (locked && dist(locked, p) <= range * 1.25) return angleOf(locked.x - p.x, locked.z - p.z);
  if (locked === undefined || (p.target && !locked)) p.target = null;
  // Keyboard play: enemies roughly in front win; with none there, the nearest one in range.
  let best = null; let bestScore = Infinity;
  for (const m of hostiles(game)) {
    const d = dist(m, p);
    if (d > range) continue;
    const off = angleDiff(angleOf(m.x - p.x, m.z - p.z), p.facing);
    const score = d + off * 4 + (off > Math.PI * 0.4 ? 100 : 0);
    if (score < bestScore) { bestScore = score; best = m; }
  }
  return best ? angleOf(best.x - p.x, best.z - p.z) : p.facing;
}

// ---- player attacks ------------------------------------------------------------------------

function basicAttack(game, p) {
  const c = D.CLASSES[p.cls];
  const b = c.basic;
  const lowHp = p.hp < p.maxHp * 0.3 ? (p.d.e.lowHpAttackSpeed || 0) : 0;
  p.cds.basic = game.time + b.interval / (p.d.attackSpeed + lowHp);
  p.basicCount += 1;
  const facing = aim(game, p, b.kind === 'melee' ? b.range + 1.5 : b.range);
  p.facing = facing;
  const damage = b.damage * p.d.basicMul;
  if (b.kind === 'melee') {
    emit(game, { k: 'swing', s: p.seat, a: round2(facing), r: b.range, arc: b.arc });
    for (const m of hostiles(game)) if (inCone(p, facing, m, b.range, b.arc, m.radius || 0.5)) hitMob(game, p, m, damage, { source: 'basic' });
  } else {
    const shots = p.d.e.twinEvery && p.basicCount % p.d.e.twinEvery === 0 ? [-0.08, 0.08] : [0];
    for (const off of shots) {
      fireProjectile(game, p, { kind: b.projectile, angle: facing + off, speed: b.speed, range: b.range, radius: b.radius, damage, pierce: p.d.e.basicPierce || 0, source: 'basic',
        burn: Boolean(p.d.e.basicBurn), slow: Boolean(p.d.e.basicSlow) });
    }
  }
  if (p.d.e.novaEvery && p.basicCount % p.d.e.novaEvery === 0) {
    emit(game, { k: 'nova', x: round2(p.x), z: round2(p.z), r: 3.5, el: 'shock' });
    for (const m of hostiles(game)) if (dist(m, p) <= 3.5 + (m.radius || 0.5)) hitMob(game, p, m, 16 * p.d.skillMul, { source: 'proc', element: 'shock' });
  }
}

function fireProjectile(game, p, spec) {
  const dir = dirOf(spec.angle);
  game.projectiles.push({ id: id(game), owner: 'p', seat: p.seat, x: p.x + dir.x * 0.7, z: p.z + dir.z * 0.7, vx: dir.x * spec.speed, vz: dir.z * spec.speed,
    left: spec.range, hit: [], hits: 0, ...spec });
}

function castSkill(game, p, slot) {
  const skillId = p.skills[slot];
  if (!skillId) return { legal: false, reason: 'no-skill' };
  if (game.time < p.cds[slot] || game.time < p.stunUntil || p.charge) return { legal: false, reason: 'cooldown' };
  const s = skillStats(p, skillId);
  p.cds[slot] = game.time + s.cooldown * (1 - p.d.cdr);
  const damage = (s.damage || 0) * p.d.skillMul;
  const range = s.range || s.distance || 8;
  const facing = aim(game, p, range);
  p.facing = facing;
  emit(game, { k: 'cast', s: p.seat, sk: skillId, a: round2(facing) });
  if (s.kind === 'cone') {
    emit(game, { k: 'swing', s: p.seat, a: round2(facing), r: s.range, arc: s.arc, heavy: 1 });
    for (const m of hostiles(game)) {
      if (!inCone(p, facing, m, s.range, s.arc, m.radius || 0.5)) continue;
      hitMob(game, p, m, damage, { source: 'skill', stun: s.stun, knock: s.knockback, from: p });
      if (s.shockwave) shockwave(game, p, m, s.shockwave, damage * 0.4);
    }
  } else if (s.kind === 'nova') {
    const pulse = () => {
      emit(game, { k: 'nova', x: round2(p.x), z: round2(p.z), r: s.radius, el: s.element || 'phys' });
      for (const m of hostiles(game)) {
        if (dist(m, p) > s.radius + (m.radius || 0.5)) continue;
        const wasSlowed = m.slowUntil > game.time;
        hitMob(game, p, m, damage, { source: 'skill', element: s.element, slow: s.slow ? { f: s.slow, t: s.slowTime } : null, freeze: s.freeze && wasSlowed ? s.freeze : 0,
          onKill: s.killCdr ? () => { p.cds[slot] -= s.killCdr; } : null });
      }
    };
    pulse();
    for (let i = 0; i < (s.repeat || 0); i += 1) game.delayed.push({ at: game.time + 0.35 * (i + 1), fn: pulse });
  } else if (s.kind === 'charge') {
    const dir = dirOf(facing);
    const duration = 0.28;
    p.charge = { vx: dir.x * s.distance / duration, vz: dir.z * s.distance / duration, until: game.time + duration, hit: [], damage, stun: s.stun, width: s.width, endNova: s.endNova, slot };
    p.invulnUntil = Math.max(p.invulnUntil, game.time + duration + 0.05);
  } else if (s.kind === 'shield') {
    const amount = s.shield * (1 + p.d.stats.vit * 0.03);
    const give = (target, share) => { target.shield = Math.max(target.shield, amount * share); target.shieldUntil = game.time + s.duration; target.shieldReflect = s.reflect || 0; };
    give(p, 1);
    if (s.partyShare) for (const ally of Object.values(game.players)) if (ally !== p && ally.state === 'ok' && dist(ally, p) < 7) give(ally, s.partyShare);
    for (const m of hostiles(game)) if (dist(m, p) <= s.taunt && !m.boss) { m.tauntSeat = p.seat; m.tauntUntil = game.time + s.duration; }
    emit(game, { k: 'shield', s: p.seat });
  } else if (s.kind === 'projectile') {
    const count = s.split || 1;
    for (let i = 0; i < count; i += 1) {
      const off = count > 1 ? (i - (count - 1) / 2) * 0.32 : 0;
      fireProjectile(game, p, { kind: s.projectile, angle: facing + off, speed: s.speed, range: s.range, radius: s.radius, damage, source: 'skill', skill: skillId,
        pierce: s.pierce || 0, pierceGrow: s.pierceGrow || 0, explode: s.explode || 0, endExplode: s.endExplode || 0, burn: Boolean(s.burn), element: s.element,
        burnDeathBlast: s.burnDeathBlast || 0 });
    }
  } else if (s.kind === 'fan') {
    const spread = s.spread * Math.PI / 180;
    for (let i = 0; i < s.count; i += 1) {
      fireProjectile(game, p, { kind: s.projectile, angle: facing - spread / 2 + spread * (i / Math.max(1, s.count - 1)), speed: s.speed, range: s.range, radius: s.radius, damage, source: 'skill' });
    }
  } else if (s.kind === 'summon') {
    const count = 1 + (s.count || 0);
    for (let i = 0; i < count; i += 1) {
      const wolf = makeMob(game, 'wolf', p.x + (i - count / 2) * 0.8, p.z + 0.6, { ownerSeat: p.seat, expires: game.time + s.duration, damageOverride: damage });
      resolveCollision(layoutOf(game), wolf, 0.45);
    }
    p.wolfCrit = Boolean(s.critLeap);
  } else if (s.kind === 'chain') {
    const first = hostiles(game).filter(m => dist(m, p) <= s.range).sort((a, b) => (angleDiff(angleOf(a.x - p.x, a.z - p.z), facing) * 6 + dist(a, p)) - (angleDiff(angleOf(b.x - p.x, b.z - p.z), facing) * 6 + dist(b, p)))[0];
    if (first) chain(game, p, first, damage, s.jumps, s.jumpRange, s.critExtra || 0);
  } else if (s.kind === 'meteor') {
    const targets = hostiles(game).filter(m => dist(m, p) <= s.range).sort((a, b) => dist(a, p) - dist(b, p));
    const count = 1 + (s.count || 0);
    for (let i = 0; i < count; i += 1) {
      const t = targets[i] || targets[0];
      const at = t ? { x: t.x, z: t.z } : { x: p.x + dirOf(facing).x * 6, z: p.z + dirOf(facing).z * 6 };
      game.hazards.push({ id: id(game), owner: 'p', seat: p.seat, kind: 'circle', x: at.x, z: at.z, r: s.radius, fireAt: game.time + s.delay + i * 0.2, damage, burn: Boolean(s.burn), el: 'fire' });
    }
  }
  return { legal: true };
}

function shockwave(game, p, center, radius, damage) {
  emit(game, { k: 'nova', x: round2(center.x), z: round2(center.z), r: radius, el: 'phys' });
  for (const m of hostiles(game)) if (m !== center && dist(m, center) <= radius + (m.radius || 0.5)) hitMob(game, p, m, damage, { source: 'proc' });
}

function chain(game, p, first, damage, jumps, jumpRange, critExtra) {
  const hit = [first];
  let current = first; let extra = 0;
  const points = [[round2(p.x), round2(p.z)], [round2(first.x), round2(first.z)]];
  const crit = hitMob(game, p, first, damage, { source: 'skill', element: 'shock' });
  if (crit && critExtra) extra += critExtra;
  for (let i = 0; i < jumps + extra; i += 1) {
    const next = hostiles(game).filter(m => !hit.includes(m) && dist(m, current) <= jumpRange).sort((a, b) => dist(a, current) - dist(b, current))[0];
    if (!next) break;
    hit.push(next);
    points.push([round2(next.x), round2(next.z)]);
    if (hitMob(game, p, next, damage * 0.85, { source: 'skill', element: 'shock' }) && critExtra && extra < critExtra * 2) extra += critExtra;
    current = next;
  }
  emit(game, { k: 'chain', pts: points });
}

// Returns true when the hit was a critical. All player damage to monsters goes through here.
function hitMob(game, p, m, raw, opts = {}) {
  if (m.hp <= 0 || m.ally) return false;
  const crit = opts.source !== 'burn' && rand(game) < p.d.crit;
  let damage = raw * (crit ? BALANCE.critMultiplier : 1);
  if (p.d.e.lowHpDamage && p.hp < p.maxHp * 0.5) damage *= 1 + p.d.e.lowHpDamage;
  damage = Math.max(1, Math.round(damage));
  m.hp -= damage;
  emit(game, { k: 'dmg', x: round2(m.x), z: round2(m.z), v: damage, c: crit ? 1 : 0, s: p.seat, el: opts.element || (opts.source === 'burn' ? 'fire' : undefined) });
  if (opts.stun && !m.boss) m.stunUntil = Math.max(m.stunUntil, game.time + opts.stun);
  if (opts.knock && opts.from && !m.boss && !m.elite) {
    const n = norm(m.x - opts.from.x, m.z - opts.from.z); m.x += n.x * opts.knock; m.z += n.z * opts.knock; resolveCollision(layoutOf(game), m, m.radius || 0.5);
  }
  if (opts.slow) { m.slowUntil = game.time + opts.slow.t * (m.boss ? 0.5 : 1); m.slowF = opts.slow.f; }
  if (opts.freeze && !m.boss) { m.frozenUntil = game.time + opts.freeze; m.frozenBy = p.seat; }
  if (opts.burn) {
    const dps = (4 + p.d.stats.int * 0.35) * (1 + (p.d.e.burnDamage || 0));
    m.burn = { dps, until: game.time + 3, seat: p.seat, blast: opts.burnDeathBlast || p.d.e.burnDeathBlast || 0 };
  }
  if (crit && opts.source !== 'proc') {
    if (p.d.e.critChain) {
      const near = hostiles(game).filter(x => x !== m && dist(x, m) < 5).sort((a, b) => dist(a, m) - dist(b, m)).slice(0, 2);
      if (near.length) {
        emit(game, { k: 'chain', pts: [[round2(m.x), round2(m.z)], ...near.map(x => [round2(x.x), round2(x.z)])] });
        for (const x of near) hitMob(game, p, x, p.d.e.critChain * p.d.skillMul, { source: 'proc', element: 'shock' });
      }
    }
    if (p.wolfCrit) for (const wolf of game.mobs) if (wolf.ally && wolf.ownerSeat === p.seat && m.hp > 0) { wolf.x = m.x + 0.8; wolf.z = m.z + 0.4; wolf.leapTarget = m.id; emit(game, { k: 'leap', x: round2(m.x), z: round2(m.z) }); }
  }
  if (m.hp <= 0) killMob(game, m, p, opts);
  return crit;
}

function killMob(game, m, p, opts = {}) {
  m.hp = 0;
  const def = D.MONSTERS[m.type];
  emit(game, { k: 'die', i: m.id, x: round2(m.x), z: round2(m.z), boss: m.boss ? 1 : 0 });
  for (const player of Object.values(game.players)) gainXp(game, player, def.xp);
  if (p) {
    if (p.d.e.killHeal) heal(game, p, p.d.e.killHeal);
    if (opts.onKill) opts.onKill();
  }
  if (m.burn && m.burn.until > game.time && m.burn.blast) {
    const owner = game.players[m.burn.seat];
    if (owner) {
      emit(game, { k: 'nova', x: round2(m.x), z: round2(m.z), r: m.burn.blast, el: 'fire' });
      for (const other of hostiles(game)) if (dist(other, m) <= m.burn.blast + (other.radius || 0.5)) hitMob(game, owner, other, 10 * owner.d.skillMul, { source: 'proc', element: 'fire', burn: true });
    }
  }
  if (m.frozenUntil > game.time && m.frozenBy) {
    const owner = game.players[m.frozenBy];
    const shards = owner && skillStats(owner, 'frostNova').shards;
    if (owner && shards && owner.mods.includes('frostShard')) {
      for (let i = 0; i < shards; i += 1) fireProjectile(game, { ...owner, x: m.x, z: m.z }, { kind: 'shard', angle: (i / shards) * Math.PI * 2, speed: 14, range: 6, radius: 0.25, damage: 9 * owner.d.skillMul, source: 'proc', slow: true });
    }
  }
  if (m.elite) for (const player of Object.values(game.players)) player.potions = Math.min(9, player.potions + 1);
  game.mobs = game.mobs.filter(x => x !== m);
  if (m.boss) victory(game);
}

function gainXp(game, p, amount) {
  if (!amount || p.level >= BALANCE.maxLevel) return;
  p.xp += amount;
  while (p.xp >= BALANCE.xpToNext(p.level) && p.level < BALANCE.maxLevel) {
    p.xp -= BALANCE.xpToNext(p.level);
    p.level += 1;
    p.pendingLevels += 1;
    p.statPoints += BALANCE.statPointsPerLevel;
    derive(p);
    emit(game, { k: 'level', s: p.seat, lv: p.level });
    dirty(game);
  }
}

// ---- damage to players ---------------------------------------------------------------------

function hurtPlayer(game, p, raw, { mob = null, melee = false } = {}) {
  if (p.state !== 'ok' || game.time < p.invulnUntil || game.phase !== 'combat') return false;
  let damage = raw * BALANCE.armorK / (BALANCE.armorK + p.d.armor);
  if (p.shield > 0 && p.shieldUntil > game.time) {
    const absorbed = Math.min(p.shield, damage);
    p.shield -= absorbed; damage -= absorbed;
    if (mob && p.shieldReflect) hitMob(game, p, mob, absorbed * p.shieldReflect, { source: 'proc' });
  }
  damage = Math.round(damage);
  if (damage > 0) {
    p.hp -= damage;
    emit(game, { k: 'hurt', s: p.seat, v: damage });
  }
  if (mob && mob.hp > 0) {
    if (melee && p.d.e.thorns) hitMob(game, p, mob, raw * p.d.e.thorns, { source: 'proc' });
    if (p.d.e.counter && rand(game) < p.d.e.counter * p.d.luck) shockwave(game, p, p, 2.8, 18 * (1 + (p.d.e.counterMul || 0)) * p.d.basicMul);
  }
  if (p.d.e.hurtFrost && rand(game) < p.d.e.hurtFrost * p.d.luck) {
    emit(game, { k: 'nova', x: round2(p.x), z: round2(p.z), r: 3, el: 'frost' });
    for (const m of hostiles(game)) if (dist(m, p) < 3 && !m.boss) { m.frozenUntil = game.time + 1.2; m.frozenBy = p.seat; }
  }
  if (p.hp <= 0) {
    if (p.d.e.cheatDeath && !p.cheatDeathUsed) { p.cheatDeathUsed = true; p.hp = Math.round(p.maxHp * 0.5); p.invulnUntil = game.time + 1; emit(game, { k: 'revive', s: p.seat }); return true; }
    p.hp = 0; p.state = 'down'; p.downAt = game.time; p.reviveProgress = 0; p.mv = 0; p.atk = false; p.charge = null;
    emit(game, { k: 'down', s: p.seat });
    dirty(game);
  }
  return true;
}

// ---- simulation --------------------------------------------------------------------------

function tick(game, dt = TICK) {
  game.fx = [];
  if (game.status !== 'playing') return;
  game.time += dt;
  const t = game.time;
  for (const task of game.delayed.filter(d => d.at <= t)) {
    game.delayed = game.delayed.filter(d => d !== task);
    if (task.fn === 'wave') spawnWave(game); else if (typeof task.fn === 'function') task.fn();
  }
  for (const s of game.spawns.filter(x => x.at <= t)) {
    game.spawns = game.spawns.filter(x => x !== s);
    const mob = makeMob(game, s.type, s.x, s.z);
    if (mob.boss) emit(game, { k: 'boss', i: mob.id });
  }
  for (const p of Object.values(game.players)) stepPlayer(game, p, dt);
  for (const m of [...game.mobs]) stepMob(game, m, dt);
  separateMobs(game);
  stepProjectiles(game, dt);
  stepHazards(game);
  if (game.status !== 'playing') return;
  stepDowned(game, dt);
  if (game.phase === 'combat') checkRoomProgress(game);
  if (game.phase === 'intermission' && game.intermissionUntil && t >= game.intermissionUntil) advance(game);
}

function stepPlayer(game, p, dt) {
  const layout = layoutOf(game);
  if (p.shield > 0 && p.shieldUntil <= game.time) p.shield = 0;
  if (p.state !== 'ok') return;
  if (game.partySize === 1 && game.phase === 'combat') p.hp = Math.min(p.maxHp, p.hp + BALANCE.solo.regenPerSecond * dt);
  if (p.charge) {
    const c = p.charge;
    const from = { x: p.x, z: p.z };
    p.x += c.vx * dt; p.z += c.vz * dt; resolveCollision(layout, p, D.CLASSES[p.cls].radius);
    for (const m of hostiles(game)) {
      if (c.hit.includes(m.id) || segmentDistance(m, from, p) > c.width / 2 + (m.radius || 0.5)) continue;
      c.hit.push(m.id);
      hitMob(game, p, m, c.damage, { source: 'skill', stun: c.stun });
    }
    if (game.time >= c.until) {
      if (c.endNova) shockwave(game, p, p, c.endNova, c.damage * 0.6);
      p.charge = null;
    }
    return;
  }
  if (p.dashLeft > 0) {
    const step = Math.min(p.dashLeft, Math.hypot(p.dashVx, p.dashVz) * dt);
    const n = norm(p.dashVx, p.dashVz);
    p.x += n.x * step; p.z += n.z * step; p.dashLeft -= step;
    if (p.dashLeft <= 1e-6) { p.dashLeft = 0; p.dashUntil = game.time; }
    resolveCollision(layout, p, D.CLASSES[p.cls].radius);
    return;
  }
  if (game.time < p.stunUntil) return;
  if (p.mv) {
    const dir = moveDir(p);
    p.x += dir.x * p.d.speed * dt; p.z += dir.z * p.d.speed * dt;
    p.facing = angleOf(dir.x, dir.z);
    resolveCollision(layout, p, D.CLASSES[p.cls].radius);
  }
  if (p.atk && game.time >= p.cds.basic && game.phase !== 'lobby') basicAttack(game, p);
}

function stepDowned(game, dt) {
  const players = Object.values(game.players);
  for (const p of players) {
    if (p.state !== 'down') continue;
    if (game.partySize === 1) {
      if (game.revivesLeft > 0 && game.time - p.downAt >= 2) {
        game.revivesLeft -= 1; p.state = 'ok'; p.hp = Math.round(p.maxHp * 0.5); p.invulnUntil = game.time + 1.5;
        emit(game, { k: 'revive', s: p.seat }); dirty(game);
      }
      continue;
    }
    const helper = players.find(a => a !== p && a.state === 'ok' && dist(a, p) <= BALANCE.reviveRange);
    p.reviveProgress = helper ? p.reviveProgress + dt / BALANCE.reviveSeconds : Math.max(0, p.reviveProgress - dt * 0.5);
    if (p.reviveProgress >= 1) {
      p.state = 'ok'; p.hp = Math.round(p.maxHp * BALANCE.reviveHpShare); p.reviveProgress = 0; p.invulnUntil = game.time + 1.2;
      emit(game, { k: 'revive', s: p.seat }); dirty(game);
    }
  }
  const soloPending = game.partySize === 1 && game.revivesLeft > 0;
  if (players.every(p => p.state === 'down') && !soloPending && game.phase === 'combat') defeat(game);
}

function nearestPlayer(game, m) {
  if (m.tauntSeat && m.tauntUntil > game.time) {
    const taunter = game.players[m.tauntSeat];
    if (taunter?.state === 'ok') return taunter;
  }
  let best = null; let bestD = Infinity;
  for (const p of Object.values(game.players)) {
    if (p.state !== 'ok') continue;
    const d = dist(p, m);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// Straight at the goal; when a pillar or wall eats most of the step, slide sideways around it
// (keeping the same side for a moment so the monster does not jitter in place).
function moveMob(game, m, dirX, dirZ, speed, dt) {
  const layout = layoutOf(game);
  const radius = D.MONSTERS[m.type].radius;
  let n = norm(dirX, dirZ);
  if (m.detourUntil > game.time) n = norm(n.x + m.detourX * 1.6, n.z + m.detourZ * 1.6);
  const fromX = m.x; const fromZ = m.z;
  m.x += n.x * speed * dt; m.z += n.z * speed * dt;
  resolveCollision(layout, m, radius);
  const moved = Math.hypot(m.x - fromX, m.z - fromZ);
  if (moved < speed * dt * 0.35 && !(m.detourUntil > game.time)) {
    const side = rand(game) < 0.5 ? 1 : -1;
    m.detourX = -n.z * side; m.detourZ = n.x * side; m.detourUntil = game.time + 0.8;
  }
  if (n.x || n.z) m.facing = angleOf(dirX, dirZ);
}

function telegraph(game, m, spec) {
  const hz = { id: id(game), owner: 'm', mob: m.id, fireAt: game.time + spec.windup, ...spec };
  game.hazards.push(hz);
  return hz;
}

function stepMob(game, m, dt) {
  const def = D.MONSTERS[m.type];
  const t = game.time;
  if (m.burn && m.burn.until > t) {
    m.burnTick = (m.burnTick || 0) + dt;
    if (m.burnTick >= 0.5) {
      m.burnTick = 0;
      const owner = game.players[m.burn.seat];
      if (owner) hitMob(game, owner, m, m.burn.dps * 0.5, { source: 'burn' });
      if (m.hp <= 0) return;
    }
  } else if (m.burn) m.burn = null;
  if (m.ally) return stepAlly(game, m, def, dt);
  if (m.frozenUntil > t || m.stunUntil > t) return;
  const speed = def.speed * (m.slowUntil > t ? m.slowF : 1) * (m.haste || 1);
  if (def.ai === 'boss') return stepBoss(game, m, def, dt, speed);
  if (m.state === 'charge') {
    m.x += m.cvx * dt; m.z += m.cvz * dt;
    const before = { x: m.x, z: m.z };
    resolveCollision(layoutOf(game), m, def.radius);
    for (const p of Object.values(game.players)) if (!m.chargeHit.includes(p.seat) && dist(p, m) < def.radius + 0.6) { m.chargeHit.push(p.seat); hurtPlayer(game, p, m.chargeDamage, { mob: m, melee: true }); }
    if (t >= m.stateUntil || Math.hypot(before.x - m.x, before.z - m.z) > 0.01) { m.state = 'recover'; m.stateUntil = t + 0.6; }
    return;
  }
  if (m.state === 'windup' || m.state === 'recover') { if (t < m.stateUntil) return; m.state = 'idle'; }
  if (t >= m.retargetAt || !m.target || m.target.state !== 'ok') { m.target = nearestPlayer(game, m); m.retargetAt = t + 1; }
  const target = m.target;
  if (!target) return;
  const d = dist(target, m);
  const dx = target.x - m.x; const dz = target.z - m.z;
  if (def.ai === 'melee') {
    if (d > def.range + def.radius) moveMob(game, m, dx, dz, speed, dt);
    else if (t >= m.cd) {
      m.state = 'windup'; m.stateUntil = t + def.windup; m.cd = t + def.cooldown; m.facing = angleOf(dx, dz);
      const facing = m.facing;
      game.delayed.push({ at: t + def.windup, fn: () => { if (m.hp > 0 && inCone(m, facing, target, def.range + def.radius + 0.4, 110)) hurtPlayer(game, target, def.damage, { mob: m, melee: true }); } });
      emit(game, { k: 'windup', i: m.id });
    }
  } else if (def.ai === 'ranged' || def.ai === 'caster') {
    if (d < def.keep - 1) moveMob(game, m, -dx, -dz, speed * 0.9, dt);
    else if (d > def.range - 0.5) moveMob(game, m, dx, dz, speed, dt);
    else m.facing = angleOf(dx, dz);
    if (t >= m.cd && d <= def.range) {
      m.cd = t + def.cooldown * (0.85 + rand(game) * 0.3);
      m.state = 'windup'; m.stateUntil = t + (def.ai === 'caster' ? 0.4 : def.windup);
      if (def.ai === 'caster') telegraph(game, m, { kind: 'circle', x: target.x, z: target.z, r: def.aoe, windup: def.windup, damage: def.damage });
      else {
        game.delayed.push({ at: t + def.windup, fn: () => {
          if (m.hp <= 0) return;
          const a = angleOf(target.x - m.x, target.z - m.z); const dir = dirOf(a);
          game.projectiles.push({ id: id(game), owner: 'm', mob: m.id, kind: 'thorn', x: m.x + dir.x * 0.6, z: m.z + dir.z * 0.6, vx: dir.x * def.projectileSpeed, vz: dir.z * def.projectileSpeed, left: def.range + 3, radius: 0.3, damage: def.damage, angle: a });
        } });
      }
    }
  } else if (def.ai === 'charger') {
    if (d > def.range) moveMob(game, m, dx, dz, speed, dt);
    else if (t >= m.cd) {
      m.cd = t + def.cooldown; m.state = 'windup'; m.stateUntil = t + def.windup;
      const a = angleOf(dx, dz); m.facing = a;
      telegraph(game, m, { kind: 'line', x: m.x, z: m.z, a, len: def.chargeDistance, w: def.radius * 2 + 0.4, windup: def.windup, damage: 0, visual: true });
      game.delayed.push({ at: t + def.windup, fn: () => {
        if (m.hp <= 0 || m.stunUntil > game.time || m.frozenUntil > game.time) return;
        const dir = dirOf(a); m.state = 'charge'; m.cvx = dir.x * def.chargeSpeed; m.cvz = dir.z * def.chargeSpeed;
        m.stateUntil = game.time + def.chargeDistance / def.chargeSpeed; m.chargeHit = []; m.chargeDamage = def.damage;
      } });
    } else moveMob(game, m, dx, dz, speed * 0.4, dt);
  } else if (def.ai === 'brute') {
    if (t >= m.slamAt) {
      m.slamAt = t + def.slamEvery; m.state = 'windup'; m.stateUntil = t + 1.1;
      telegraph(game, m, { kind: 'circle', x: m.x, z: m.z, r: def.slamRadius, windup: 1.1, damage: def.damage * 1.1 });
    } else if (d > def.range) moveMob(game, m, dx, dz, speed, dt);
    else if (t >= m.cd) {
      m.cd = t + def.cooldown; m.state = 'windup'; m.stateUntil = t + def.windup;
      const a = angleOf(dx, dz); m.facing = a;
      telegraph(game, m, { kind: 'cone', x: m.x, z: m.z, a, r: def.range + 0.8, arc: def.arc, windup: def.windup, damage: def.damage });
    }
  }
}

function stepAlly(game, m, def, dt) {
  const t = game.time;
  if (m.expires && t >= m.expires) { game.mobs = game.mobs.filter(x => x !== m); emit(game, { k: 'die', i: m.id, x: round2(m.x), z: round2(m.z) }); return; }
  const owner = game.players[m.ownerSeat];
  const foes = hostiles(game);
  const target = (m.leapTarget && foes.find(x => x.id === m.leapTarget)) || foes.sort((a, b) => dist(a, m) - dist(b, m))[0];
  if (!target || !owner) { if (owner && dist(owner, m) > 2.5) moveMob(game, m, owner.x - m.x, owner.z - m.z, def.speed, dt); return; }
  const d = dist(target, m);
  if (d > def.range + (target.radius || 0.5)) moveMob(game, m, target.x - m.x, target.z - m.z, def.speed, dt);
  else if (t >= m.cd) { m.cd = t + def.cooldown; m.facing = angleOf(target.x - m.x, target.z - m.z); hitMob(game, owner, target, m.damageOverride || def.damage, { source: 'proc' }); m.leapTarget = null; }
}

function stepBoss(game, m, def, dt, speed) {
  const t = game.time;
  const P = def.patterns;
  const n = game.partySize - 1;
  const hpShare = m.hp / m.maxHp;
  for (let i = m.phase; i < def.phases.length; i += 1) {
    const phase = def.phases[i];
    if (hpShare > phase.below) break;
    m.phase = i + 1; m.haste = phase.haste; m.enraged = Boolean(phase.enrage);
    for (const [type, count] of Object.entries(phase.summon || {})) {
      for (let k = 0; k < Math.round(count * BALANCE.party.mobCount[n]); k += 1) { const at = spawnPoint(game); game.spawns.push({ type, x: at.x, z: at.z, at: t + BALANCE.spawnWarn }); }
    }
    emit(game, { k: 'phase', i: m.id, ph: m.phase });
    dirty(game);
  }
  if (m.state === 'charge') {
    m.x += m.cvx * dt; m.z += m.cvz * dt;
    const before = { x: m.x, z: m.z };
    resolveCollision(layoutOf(game), m, def.radius);
    for (const p of Object.values(game.players)) if (!m.chargeHit.includes(p.seat) && dist(p, m) < def.radius + 0.7) { m.chargeHit.push(p.seat); hurtPlayer(game, p, P.charge.damage, { mob: m }); }
    if (t >= m.stateUntil || Math.hypot(before.x - m.x, before.z - m.z) > 0.01) { m.state = 'recover'; m.stateUntil = t + 0.9; }
    return;
  }
  if (m.state === 'windup' || m.state === 'recover') { if (t < m.stateUntil) return; m.state = 'idle'; }
  if (t >= m.retargetAt || !m.target || m.target.state !== 'ok') { m.target = nearestPlayer(game, m); m.retargetAt = t + 2.5; }
  const target = m.target;
  if (!target) return;
  const d = dist(target, m);
  const dx = target.x - m.x; const dz = target.z - m.z;
  const haste = m.haste || 1;
  if (t < m.cd) { if (d > 2.6) moveMob(game, m, dx, dz, speed * 0.8, dt); else m.facing = angleOf(dx, dz); return; }
  const a = angleOf(dx, dz); m.facing = a;
  const options = [];
  if (d <= P.swipe.radius + 0.5) options.push(['swipe', 4]);
  options.push(['breath', d < 9 ? 2.2 : 0.6], ['circles', 2.2]);
  if (d > 5) options.push(['charge', 2.4]);
  if (m.phase >= 1) options.push(['ring', 1.6]);
  if (d > P.swipe.radius + 0.5 && d <= 5) options.push(['approach', 2]);
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let r = rand(game) * total; let choice = options[0][0];
  for (const [name, w] of options) { r -= w; if (r <= 0) { choice = name; break; } }
  const windup = w => w / haste;
  if (choice === 'approach') { moveMob(game, m, dx, dz, speed, dt); return; }
  if (choice === 'swipe') {
    telegraph(game, m, { kind: 'cone', x: m.x, z: m.z, a, r: P.swipe.radius, arc: P.swipe.arc, windup: windup(P.swipe.windup), damage: P.swipe.damage });
    m.state = 'windup'; m.stateUntil = t + windup(P.swipe.windup) + 0.2; m.cd = t + windup(P.swipe.windup) + 0.7 / haste;
  } else if (choice === 'breath') {
    telegraph(game, m, { kind: 'cone', x: m.x, z: m.z, a, r: P.breath.radius, arc: P.breath.arc, windup: windup(P.breath.windup), damage: P.breath.damage, el: 'fire' });
    m.state = 'windup'; m.stateUntil = t + windup(P.breath.windup) + 0.3; m.cd = t + windup(P.breath.windup) + 1.2 / haste;
  } else if (choice === 'charge') {
    telegraph(game, m, { kind: 'line', x: m.x, z: m.z, a, len: P.charge.distance, w: P.charge.width, windup: windup(P.charge.windup), damage: 0, visual: true });
    m.state = 'windup'; m.stateUntil = t + windup(P.charge.windup); m.cd = t + windup(P.charge.windup) + P.charge.distance / P.charge.speed + 1.2 / haste;
    game.delayed.push({ at: t + windup(P.charge.windup), fn: () => {
      if (m.hp <= 0) return;
      const dir = dirOf(a); m.state = 'charge'; m.cvx = dir.x * P.charge.speed; m.cvz = dir.z * P.charge.speed;
      m.stateUntil = game.time + P.charge.distance / P.charge.speed; m.chargeHit = [];
    } });
  } else if (choice === 'circles') {
    const count = P.circles.count + BALANCE.party.bossExtraCircles[n] + (m.enraged ? 1 : 0);
    const alive = Object.values(game.players).filter(p => p.state === 'ok');
    for (let i = 0; i < count; i += 1) {
      const p = alive[i % alive.length];
      const jitter = i < alive.length ? 0 : 2.5;
      telegraph(game, m, { kind: 'circle', x: p.x + (rand(game) - 0.5) * jitter * 2, z: p.z + (rand(game) - 0.5) * jitter * 2, r: P.circles.radius, windup: windup(P.circles.windup) + i * 0.12, damage: P.circles.damage, el: 'fire' });
    }
    m.state = 'recover'; m.stateUntil = t + 0.5; m.cd = t + windup(P.circles.windup) + 0.8 / haste;
  } else if (choice === 'ring') {
    telegraph(game, m, { kind: 'ring', x: m.x, z: m.z, r: P.ring.outer, r2: P.ring.inner, windup: windup(P.ring.windup), damage: P.ring.damage, el: 'fire' });
    m.state = 'windup'; m.stateUntil = t + windup(P.ring.windup) + 0.3; m.cd = t + windup(P.ring.windup) + 1.1 / haste;
  }
}

function separateMobs(game) {
  const list = game.mobs;
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]; const b = list[j];
      const ra = D.MONSTERS[a.type].radius; const rb = D.MONSTERS[b.type].radius;
      const dx = b.x - a.x; const dz = b.z - a.z; const l = Math.hypot(dx, dz); const min = (ra + rb) * 0.9;
      if (l >= min || l < 1e-6) continue;
      const push = (min - l) / 2; const nx = dx / l; const nz = dz / l;
      const wa = a.boss ? 0 : 1; const wb = b.boss ? 0 : 1;
      a.x -= nx * push * wa * (wb ? 1 : 2); a.z -= nz * push * wa * (wb ? 1 : 2);
      b.x += nx * push * wb * (wa ? 1 : 2); b.z += nz * push * wb * (wa ? 1 : 2);
    }
  }
  const layout = layoutOf(game);
  for (const m of list) resolveCollision(layout, m, D.MONSTERS[m.type].radius);
}

function explode(game, pr, x, z, radius) {
  const p = game.players[pr.seat];
  emit(game, { k: 'nova', x: round2(x), z: round2(z), r: radius, el: pr.element || (pr.burn ? 'fire' : 'phys') });
  if (!p) return;
  for (const m of hostiles(game)) if (Math.hypot(m.x - x, m.z - z) <= radius + (m.radius || 0.5)) {
    hitMob(game, p, m, pr.damage * (pr.hit.includes(m.id) ? 0.5 : 1), { source: pr.source, element: pr.element, burn: pr.burn, burnDeathBlast: pr.burnDeathBlast });
  }
}

function stepProjectiles(game, dt) {
  const layout = layoutOf(game);
  const keep = [];
  for (const pr of game.projectiles) {
    const speed = Math.hypot(pr.vx, pr.vz);
    const steps = Math.max(1, Math.ceil(speed * dt / 0.4));
    let alive = true;
    for (let s = 0; s < steps && alive; s += 1) {
      pr.x += pr.vx * dt / steps; pr.z += pr.vz * dt / steps; pr.left -= speed * dt / steps;
      if (blocked(layout, pr.x, pr.z, 0.05) || pr.left <= 0) {
        if (pr.explode || pr.endExplode) explode(game, pr, pr.x, pr.z, pr.explode || pr.endExplode);
        alive = false; break;
      }
      if (pr.owner === 'p') {
        const p = game.players[pr.seat];
        for (const m of hostiles(game)) {
          if (pr.hit.includes(m.id) || Math.hypot(m.x - pr.x, m.z - pr.z) > (m.radius || 0.5) + pr.radius) continue;
          pr.hit.push(m.id);
          if (pr.explode) { explode(game, pr, pr.x, pr.z, pr.explode); alive = false; break; }
          if (p) hitMob(game, p, m, pr.damage * (1 + (pr.pierceGrow || 0) * pr.hits), { source: pr.source, element: pr.element, burn: pr.burn, slow: pr.slow ? { f: 0.6, t: 1.5 } : null, burnDeathBlast: pr.burnDeathBlast });
          pr.hits += 1;
          if (pr.hits > (pr.pierce || 0)) {
            if (pr.endExplode) explode(game, pr, pr.x, pr.z, pr.endExplode);
            alive = false; break;
          }
        }
      } else {
        for (const p of Object.values(game.players)) {
          if (p.state !== 'ok' || Math.hypot(p.x - pr.x, p.z - pr.z) > 0.55 + pr.radius) continue;
          const mob = game.mobs.find(m => m.id === pr.mob);
          if (hurtPlayer(game, p, pr.damage, { mob }) || game.time >= p.invulnUntil) { alive = false; break; }
        }
      }
    }
    if (alive) keep.push(pr);
  }
  game.projectiles = keep;
}

function inHazard(h, e, pad) {
  if (h.kind === 'circle') return Math.hypot(e.x - h.x, e.z - h.z) <= h.r + pad;
  if (h.kind === 'ring') { const d = Math.hypot(e.x - h.x, e.z - h.z); return d <= h.r + pad && d >= h.r2 - pad; }
  if (h.kind === 'cone') return inCone(h, h.a, e, h.r, h.arc, pad);
  if (h.kind === 'line') { const dir = dirOf(h.a); return segmentDistance(e, h, { x: h.x + dir.x * h.len, z: h.z + dir.z * h.len }) <= h.w / 2 + pad; }
  return false;
}

function stepHazards(game) {
  const t = game.time;
  const keep = [];
  for (const h of game.hazards) {
    if (!h.fired && t >= h.fireAt) {
      h.fired = true;
      const src = h.mob ? game.mobs.find(m => m.id === h.mob) : null;
      if (h.owner === 'm') {
        // A telegraph from a monster that died or got stunned before it landed does nothing.
        if (!h.visual && h.damage && (!h.mob || (src && src.hp > 0 && src.frozenUntil <= t && src.stunUntil <= t))) {
          if (h.kind !== 'line' && src && h.kind === 'cone') { h.x = src.x; h.z = src.z; }
          for (const p of Object.values(game.players)) if (inHazard(h, p, 0.45)) hurtPlayer(game, p, h.damage, { mob: src });
        }
      } else {
        const p = game.players[h.seat];
        emit(game, { k: 'nova', x: round2(h.x), z: round2(h.z), r: h.r, el: h.el || 'phys' });
        if (p) for (const m of hostiles(game)) if (inHazard(h, m, m.radius || 0.5)) hitMob(game, p, m, h.damage, { source: 'skill', element: h.el, burn: h.burn });
      }
    }
    if (!h.fired || t < h.fireAt + 0.3) keep.push(h);
  }
  game.hazards = keep;
}

// ---- views ---------------------------------------------------------------------------------

// Everything that changes rarely (builds, choices, room) -- sent with the ordinary room state.
function publicState(game) {
  return {
    status: game.status, phase: game.phase, round: game.round, metaVersion: game.metaVersion,
    region: D.REGION.name, roomIndex: game.roomIndex, roomCount: D.REGION.rooms.length,
    rooms: D.REGION.rooms.map(r => ({ kind: r.kind, label: r.label || D.ROOM_KIND_NAME[r.kind] })),
    room: game.room ? { kind: game.room.kind, label: game.room.label, layoutId: game.room.layoutId, layoutName: game.room.layout.name,
      bounds: game.room.layout.bounds, obstacles: game.room.layout.obstacles, cleared: game.room.cleared, chest: game.room.chest, waves: game.room.waves.length, wave: game.room.wave } : null,
    classes: { ...game.classes }, seatOrder: [...game.seatOrder], partySize: game.partySize, revivesLeft: game.revivesLeft,
    intermissionLeft: game.phase === 'intermission' && game.intermissionUntil ? Math.max(0, Math.round(game.intermissionUntil - game.time)) : null,
    players: Object.fromEntries(Object.entries(game.players).map(([seat, p]) => [seat, {
      cls: p.cls, level: p.level, statPoints: p.statPoints, stats: { ...p.d.stats }, alloc: { ...p.alloc },
      derived: { maxHp: p.maxHp, armor: Math.round(p.d.armor), crit: Math.round(p.d.crit * 100), attackSpeed: Math.round(p.d.attackSpeed * 100), speed: round2(p.d.speed), cdr: Math.round(p.d.cdr * 100), skill: Math.round(p.d.skillMul * 100), basic: Math.round(p.d.basicMul * 100) },
      skills: Object.fromEntries(SLOT_KEYS.map(k => [k, p.skills[k] ? { id: p.skills[k], name: skillDef(p.skills[k]).name, cooldown: round2(skillStats(p, p.skills[k]).cooldown * (1 - p.d.cdr)),
        mods: (skillDef(p.skills[k]).mods || []).filter(mod => p.mods.includes(mod.id)).map(mod => mod.name.replace(/^.*?: /, '')) } : null])),
      basic: D.CLASSES[p.cls].basic.name, dashCooldown: round2(BALANCE.dash.cooldown * (1 - (p.d.e.dashCdr || 0))),
      passives: Object.entries(p.passives).map(([pid, count]) => ({ id: pid, name: D.PASSIVES.find(x => x.id === pid)?.name, count })),
      items: [p.items.weapon, p.items.armor, ...p.items.trinkets].filter(Boolean).map(itemId => { const it = itemDef(itemId); return { id: it.id, name: it.name, slot: it.slot, rarity: it.rarity, desc: it.desc }; }),
      potions: p.potions, pendingLevels: p.pendingLevels, choices: p.choices, itemChoices: p.itemChoices, ready: p.ready,
    }])),
    result: game.result,
    classInfo: Object.fromEntries(Object.entries(D.CLASSES).map(([key, c]) => [key, { name: c.name, radius: c.radius, color: c.color, basic: c.basic.name, q: D.SKILLS[c.q].name, hp: c.hp }])),
    dash: BALANCE.dash,
  };
}

// Fast-changing positions for the render loop (sent every tick). Rounded to keep it small.
function snapshot(game) {
  const t = game.time;
  const cd = v => Math.max(0, round2(v - t));
  return {
    t: round2(t), ph: game.phase, ri: game.roomIndex, mv: game.metaVersion,
    p: game.seatOrder.map(seat => {
      const p = game.players[seat];
      return { s: seat, x: round2(p.x), z: round2(p.z), a: round2(p.facing), hp: Math.ceil(p.hp), mh: p.maxHp, sh: Math.ceil(p.shield), st: p.state,
        d: t < p.dashUntil || p.charge ? 1 : 0, rv: round2(p.reviveProgress), lv: p.level, xp: Math.floor(p.xp), xn: BALANCE.xpToNext(p.level), tg: p.target,
        cd: { b: cd(p.cds.basic), d: cd(p.cds.dash), q: cd(p.cds.q), w: cd(p.cds.w), e: cd(p.cds.e), r: cd(p.cds.r) }, po: p.potions };
    }),
    m: game.mobs.map(m => ({ i: m.id, k: m.type, x: round2(m.x), z: round2(m.z), a: round2(m.facing), hp: Math.max(0, Math.ceil(m.hp)), mh: m.maxHp,
      st: m.state === 'windup' ? 'w' : m.state === 'charge' ? 'c' : '', fr: m.frozenUntil > t ? 1 : 0, sl: m.slowUntil > t ? 1 : 0, bu: m.burn ? 1 : 0, sn: m.stunUntil > t ? 1 : 0,
      el: m.elite ? 1 : 0, bo: m.boss ? 1 : 0, al: m.ally ? 1 : 0, ph: m.phase || 0, tg: m.target?.seat || null })),
    pr: game.projectiles.map(pr => ({ i: pr.id, k: pr.kind, x: round2(pr.x), z: round2(pr.z), a: round2(angleOf(pr.vx, pr.vz)), o: pr.owner })),
    hz: game.hazards.map(h => ({ i: h.id, k: h.kind, x: round2(h.x), z: round2(h.z), r: h.r, r2: h.r2, a: h.a !== undefined ? round2(h.a) : undefined, arc: h.arc, len: h.len, w: h.w,
      f: round2(h.fireAt - t), fired: h.fired ? 1 : 0, o: h.owner, el: h.el })),
    sp: game.spawns.map(s => ({ x: round2(s.x), z: round2(s.z), k: s.type, f: round2(s.at - t) })),
    fx: game.fx,
  };
}

function moveError(reason) {
  return {
    started: '이미 시작한 원정입니다.', 'bad-class': '선택할 수 없는 역할입니다.', 'player-count': '1~4명이 자리를 선택해야 합니다.',
    'no-class': '자리에 앉은 모든 참가자가 역할을 골라야 시작할 수 있습니다.', 'not-playing': '진행 중인 원정이 아닙니다.', 'not-now': '지금은 선택할 수 없습니다.',
    'bad-choice': '선택할 수 없는 항목입니다.', 'no-slot': '빈 스킬 칸이 없습니다.', 'bad-stat': '알 수 없는 능력치입니다.', 'no-points': '남은 능력치 포인트가 없습니다.',
    pending: '레벨업·아이템 선택을 먼저 마쳐 주세요.', down: '쓰러진 상태입니다.', cooldown: '아직 사용할 수 없습니다.', 'no-skill': '비어 있는 스킬 칸입니다.',
    'no-item': '사용할 아이템이 없습니다.', full: 'HP가 가득 찼습니다.', 'bad-action': '알 수 없는 행동입니다.',
  }[reason] || '지금은 처리할 수 없습니다.';
}

module.exports = {
  SEATS, MOVE_BITS, create, reset, setClass, start, input, releaseInput, act, tick, chooseLevelUp, allocateStat, chooseItem, setReady, advance,
  publicState, snapshot, moveError, defeat, resolveCollision, blocked, skillStats, derive, gainXp, hurtPlayer, hitMob, makeMob, enterRoom,
};
