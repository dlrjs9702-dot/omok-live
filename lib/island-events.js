'use strict';

// v1.10.11 게임 아일랜드 서버 공용 랜덤 이벤트 (비공개 IDEAS 「서버 공용 랜덤 이벤트」, 사용자 확정 2026-10-04): one set of events
// for the whole server. 15 are always out: 14 everyday finds (trash, herbs, berries, mushrooms, coins, a wallet) and one
// that an NPC starts (a tourist's photo, or someone's lost thing). Solving one removes it for everyone and puts a new one
// somewhere else. Memory only: a restart lays out a fresh 15. Places follow the ground (shore finds on the shore, woods
// finds by the trees, NPCs on the walks) and keep clear of buildings, trees, other events and the plaza.
// Numbers the decision left open are data here (see PROJECT_STATUS.md v1.10.11).
const T = require('../public/plaza/island-terrain.js');
const seoulMonth = (ms) => new Date(ms + 9 * 3600 * 1000).getUTCMonth(); // 0-based: 9 = October

const ACTIVE = 15; // IDEAS: 15 out at all times
const NPC_ACTIVE = 1; // IDEAS: at most one NPC event at a time -- and the other 14 are everyday finds
const NEAR = 90; // events this close to a player are sent to that player (3D view); the minimap shows fewer
const REACH = 3; // how close the server wants the player when solving
const GAP = 7; // events never closer than this to each other
const LOST_KEEP_MS = 15 * 60 * 1000; // a picked-up lost thing not returned by then: the owner gives up (the event ends)
const NPC_KEEP_MS = 25 * 60 * 1000; // an NPC event nobody takes up ends and another starts

// where: the ground it appears on. item: what goes in the bag. points: paid at once. max: how many of that kind at once.
const TYPES = {
  beach_trash: { name: '해안 쓰레기', verb: '줍기', where: 'shore', item: 'trash', max: 4, weight: 3 },
  grass_trash: { name: '풀밭 쓰레기', verb: '줍기', where: 'grass', item: 'trash', max: 3, weight: 3 },
  herb: { name: '희귀 약재', verb: '채집', where: 'woods', item: 'herb', max: 2, weight: 2 },
  berry: { name: '나무 열매', verb: '채집', where: 'tree', item: 'berry', qty: 2, max: 2, weight: 2 },
  mushroom: { name: '버섯', verb: '채집', where: 'woods', item: 'mushroom', max: 2, weight: 2 },
  coin: { name: '떨어진 동전', verb: '줍기', where: 'walk', points: 2000, max: 2, weight: 2 }, // v1.10.35 단가 (경제 기준 통합)
  wallet: { name: '잃어버린 지갑', verb: '줍기', where: 'walkside', item: 'wallet', max: 1, weight: 1 },
  photo: { name: '관광객 사진 부탁', verb: '사진 찍기', where: 'view', points: 6000, npc: true, weight: 1 },
  // v1.10.39 섬 전체 할로윈 (IDEAS, 사용자 확정 2026-10-07): in October (Asia/Seoul) candy bags lie about the grass
  candy: { name: '사탕 주머니', verb: '줍기', where: 'grass', item: 'candy', max: 4, weight: 3, month: 9 },
  lost: { name: '분실물 찾아주기', verb: '줍기', returnVerb: '돌려주기', talkVerb: '말 걸기', where: 'walk', item: 'lost', points: 10000, npc: true, weight: 1 },
};

function createIslandEvents({ random = Math.random, now = () => Date.now() } = {}) {
  const events = new Map(); // id -> event
  let seq = 0;
  const solids = T.natureSolids();
  const spots = T.BUILDINGS; // v1.10.13: the cottages too
  const trees = T.nature().trees;
  const rnd = (a, b) => a + random() * (b - a);
  const pick = (list) => list[Math.floor(random() * list.length)];

  // Somewhere anything may lie: on standable ground, off the plaza, clear of buildings, trees, bushes, lamps and statues.
  function clear(x, z, { gap = GAP, away = null } = {}) {
    if (!T.walkable(x, z) || Math.hypot(x, z) < T.PLAZA_R + 4) return false;
    for (const s of spots) if (s.kind !== 'townhall' && Math.hypot(x - s.x, z - s.z) < (s.kind === 'hall' ? 14 : 7)) return false;
    if (T.inTownhall(x, z, 3)) return false; // v1.10.41: the town hall and its walled yard
    for (const s of T.STATUE_SPOTS) if (Math.hypot(x - s.x, z - s.z) < 3) return false;
    for (const s of solids) if (!s.skip && Math.abs(x - s.x) < 3 && Math.abs(z - s.z) < 3 && Math.hypot(x - s.x, z - s.z) < s.r + 0.9) return false;
    for (const e of events.values()) for (const p of placesOf(e)) if (Math.hypot(x - p.x, z - p.z) < gap) return false;
    if (away && Math.hypot(x - away.x, z - away.z) < 15) return false; // a new one never where the last one was
    return true;
  }
  const anywhere = () => { const a = rnd(0, Math.PI * 2); const r = Math.sqrt(random()) * 100; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; };
  const onWalk = (edge = false) => {
    const w = pick(T.walkCurves); const i = Math.floor(random() * (w.pts.length - 1)); const [x, z] = w.pts[i]; const [x2, z2] = w.pts[i + 1];
    const l = Math.hypot(x2 - x, z2 - z) || 1; const side = random() < 0.5 ? -1 : 1;
    const off = edge ? w.w / 2 + rnd(0.4, 1.2) : rnd(0, w.w / 2 - 0.4);
    return { x: x - ((z2 - z) / l) * off * side, z: z + ((x2 - x) / l) * off * side };
  };
  const GROUNDS = {
    shore: () => { const a = rnd(0, Math.PI * 2); const p = { x: Math.cos(a) * (T.coastR(a) - rnd(3, 7)), z: Math.sin(a) * (T.coastR(a) - rnd(3, 7)) }; return T.cliffAt(p.x, p.z) < 0.3 && T.coastDist(p.x, p.z) > 2.6 ? p : null; },
    grass: () => { const p = anywhere(); return T.coastDist(p.x, p.z) > 9 && T.walkDist(p.x, p.z) > 2 ? p : null; },
    woods: () => { const t = pick(trees); const a = rnd(0, Math.PI * 2); const d = rnd(1.8, 3.5); const p = { x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d }; return T.walkDist(p.x, p.z) > 1.5 ? p : null; },
    tree: () => { const t = pick(trees); const a = rnd(0, Math.PI * 2); const d = 0.75 * t.s + 0.95; return { x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d, tree: { x: t.x, z: t.z, s: t.s } }; },
    walk: () => onWalk(false),
    walkside: () => onWalk(true),
    view: () => { const a = rnd(0, Math.PI * 2); const p = { x: Math.cos(a) * (T.coastR(a) - rnd(5, 9)), z: Math.sin(a) * (T.coastR(a) - rnd(5, 9)) }; return T.coastDist(p.x, p.z) > 4 ? p : null; },
  };
  function placeFor(where, away, tries = 300) {
    for (let k = 0; k < tries; k += 1) {
      const p = GROUNDS[where]();
      if (!p) continue;
      p.x = Math.round(p.x * 100) / 100; p.z = Math.round(p.z * 100) / 100;
      if (where === 'tree' ? clearNearTree(p, away) : clear(p.x, p.z, { away })) return p;
    }
    return null;
  }
  function clearNearTree(p, away) { // berries hang on their tree's edge: every other rule but that one tree
    const own = p.tree; delete p.tree;
    const saved = solids.filter((s) => s.x === own.x && s.z === own.z);
    for (const s of saved) s.skip = true;
    const ok = clear(p.x, p.z, { away });
    for (const s of saved) delete s.skip;
    return ok;
  }
  function placesOf(e) {
    const out = [{ x: e.x, z: e.z }];
    if (e.npc) out.push({ x: e.npc.x, z: e.npc.z });
    return out;
  }

  function count(type) { let n = 0; for (const e of events.values()) if (e.type === type) n += 1; return n; }
  function npcCount() { let n = 0; for (const e of events.values()) if (TYPES[e.type].npc) n += 1; return n; }
  const inSeason = (def) => def.month === undefined || seoulMonth(now()) === def.month;
  function spawn(away = null, only = null) {
    const wantNpc = npcCount() < NPC_ACTIVE;
    const open = Object.entries(TYPES).filter(([type, def]) => (only ? type === only : Boolean(def.npc) === wantNpc && inSeason(def) && (def.npc || count(type) < def.max))); // `only`: tests (spawnLost)
    let total = open.reduce((s, [, d]) => s + d.weight, 0); let r = random() * total; let chosen = open[0];
    for (const entry of open) { r -= entry[1].weight; if (r <= 0) { chosen = entry; break; } }
    if (!chosen) return null;
    const [type, def] = chosen;
    const at = placeFor(def.where, away);
    if (!at) return null;
    const e = { id: `e${(seq += 1).toString(36)}${Math.floor(random() * 1e6).toString(36)}`, type, x: at.x, z: at.z, createdAt: now(), state: 'open', carrier: null, pickedAt: null };
    if (type === 'lost') { // the owner waits on a walk; the thing lies on the grass a little way off
      e.npc = { x: at.x, z: at.z };
      const item = (() => { for (let k = 0; k < 200; k += 1) { const p = GROUNDS.grass(); if (p && Math.hypot(p.x - at.x, p.z - at.z) > 12 && Math.hypot(p.x - at.x, p.z - at.z) < 32 && clear(p.x, p.z)) return p; } return null; })();
      if (!item) return null;
      e.x = Math.round(item.x * 100) / 100; e.z = Math.round(item.z * 100) / 100;
    } else if (type === 'photo') e.npc = { x: at.x, z: at.z };
    events.set(e.id, e);
    return e;
  }
  function fill(away = null) {
    for (let guard = 0; events.size < ACTIVE && guard < 40; guard += 1) spawn(away);
  }
  // Time limits: an NPC event nobody takes up, and a lost thing never returned, end; the slot is filled again.
  function expire() {
    const t = now(); const gone = [];
    for (const e of events.values()) {
      if (!inSeason(TYPES[e.type])) { if (!e.busy) { events.delete(e.id); gone.push(e.id); } continue; } // October's candy gone in November
      if (!TYPES[e.type].npc) continue;
      if ((e.state === 'carried' && t - e.pickedAt > LOST_KEEP_MS) || (e.state === 'open' && t - e.createdAt > NPC_KEEP_MS)) { events.delete(e.id); gone.push(e.id); }
    }
    if (gone.length) fill();
    return gone;
  }

  // What one player is told: the events near them, each with the place to stand and what Space does there. A lost
  // thing someone else carries shows only its waiting owner (no action).
  function nearby(x, z, account) {
    const out = [];
    for (const e of events.values()) {
      const def = TYPES[e.type];
      if (e.type === 'lost') {
        // v1.10.34 부탁: whoever has talked to the owner knows where the thing is, wherever they are (its mark on the map)
        if (e.state === 'open' && (Math.hypot(e.x - x, e.z - z) <= NEAR || e.askers?.has(account))) out.push({ id: e.id, kind: 'lost_item', x: e.x, z: e.z, verb: def.verb });
        if (Math.hypot(e.npc.x - x, e.npc.z - z) <= NEAR) out.push({ id: e.id, kind: 'lost_owner', x: e.npc.x, z: e.npc.z, verb: e.state === 'carried' ? (e.carrier === account ? def.returnVerb : null) : def.talkVerb });
        // v1.10.32 운반: the thing I carry, wherever I am (held in my hands; its owner's place for the map)
        if (e.state === 'carried' && e.carrier === account) out.push({ id: e.id, kind: 'carrying', x: e.npc.x, z: e.npc.z, verb: null });
        continue;
      }
      if (Math.hypot(e.x - x, e.z - z) <= NEAR) out.push({ id: e.id, kind: e.type, x: e.x, z: e.z, verb: def.verb });
    }
    return out;
  }

  // Taking an event, step one (synchronous, so two players can never both take it): what to do, or why not.
  function claim(id, account, pos, { owner = false } = {}) {
    const e = events.get(id);
    if (!e) return { error: 'GONE' };
    const def = TYPES[e.type];
    // v1.10.34 부탁: talking to the owner of a thing not found yet -- they ask me to find it (nothing changes but that I
    // now know where it is); nothing is paid or taken
    if (e.type === 'lost' && owner && e.state === 'open') {
      if (!pos || Math.hypot(pos.x - e.npc.x, pos.z - e.npc.z) > REACH) return { error: 'TOO_FAR' };
      (e.askers ||= new Set()).add(account);
      return { event: e, action: 'talk', points: def.points, title: def.name };
    }
    const at = e.type === 'lost' && e.state === 'carried' ? e.npc : e;
    if (!pos || Math.hypot(pos.x - at.x, pos.z - at.z) > REACH) return { error: 'TOO_FAR' };
    if (e.busy) return { error: 'GONE' };
    if (e.type === 'lost' && e.state === 'carried') {
      if (e.carrier !== account) return { error: 'GONE' };
      e.busy = true;
      return { event: e, action: 'return', points: def.points, title: def.name };
    }
    e.busy = true;
    if (e.type === 'lost') return { event: e, action: 'pickup', item: def.item, qty: 1, meta: { eventId: e.id } };
    if (def.item) return { event: e, action: 'item', item: def.item, qty: def.qty || 1 };
    return { event: e, action: 'points', points: def.points, title: def.name };
  }
  // Step two, after the store answered: done (the event ends, or a lost thing is now carried), or undone.
  function settle(claimed, ok, account) {
    const e = claimed.event; delete e.busy;
    if (!ok || !events.has(e.id)) return null;
    if (claimed.action === 'pickup') { e.state = 'carried'; e.carrier = account; e.pickedAt = now(); return { carried: e.id }; }
    events.delete(e.id);
    const away = { x: e.x, z: e.z };
    fill(away);
    return { removed: e.id };
  }
  // v1.10.32: the lost thing an account carries (its id), for everyone's view of that player
  const carryOf = (account) => { for (const e of events.values()) if (e.type === 'lost' && e.state === 'carried' && e.carrier === account) return e.id; return null; };
  // tests only (server NODE_ENV=test): the NPC event made a lost thing, so the carry and the giving back can be walked
  function spawnLost() {
    for (const e of [...events.values()]) if (TYPES[e.type].npc && e.state === 'open') events.delete(e.id);
    for (let k = 0; k < 40; k += 1) { const e = spawn(null, 'lost'); if (e) return e; }
    return null;
  }
  const activeLost = () => [...events.values()].filter((e) => e.type === 'lost').map((e) => e.id);

  fill();
  return { events, nearby, claim, settle, expire, fill, activeLost, carryOf, spawnLost, size: () => events.size };
}

module.exports = { createIslandEvents, seoulMonth, TYPES, ACTIVE, NPC_ACTIVE, NEAR, REACH, GAP };
