'use strict';

// Shared life resources (v1.10.50): per-kind slots/cooldowns, separate from one NPC request.
// A restart creates a fresh shared layout with new claim IDs. Inventory and ledger use the existing persistent store.
const T = require('../public/plaza/island-terrain.js');
const { createIslandResidents } = require('./island-residents');
const Fishing = require('./island-fishing'); // (Q2: the photo spots)
const seoulMonth = (ms) => new Date(ms + 9 * 3600 * 1000).getUTCMonth(); // 0-based: 9 = October

// Resource slots are independent of the single NPC request. Unit prices remain in island-items.
// v1.10.77: a berry on every fruit tree (island-terrain harvestTrees: the 20 of v1.10.50 and the other fruit trees)
const RESOURCE_COUNTS = { beach_trash: 8, grass_trash: 6, herb: 2, berry: T.harvestTrees().length, mushroom: 6, coin: 3, wallet: 1, candy: 4 };
const REGEN_MS = { beach_trash: 600000, grass_trash: 600000, herb: 2400000, berry: T.harvestTrees().length * 60000 /* v1.10.77: 60 berries an hour across all the fruit trees, as with 20 trees at 20 min */, mushroom: 900000, coin: 1200000, wallet: 3600000, candy: 900000 };
const ACTIVE = Object.values(RESOURCE_COUNTS).reduce((a,b) => a+b,0) + 1;
const NPC_ACTIVE = 1; // IDEAS: at most one NPC event at a time
const NEAR = 90; // events this close to a player are sent to that player (3D view); the minimap shows fewer
const REACH = 3; // how close the server wants the player when solving
const PHOTO_RANGE = 12; const PHOTO_POSE_MS = 2000; // (Q2 사진 부탁: within this of the tourist, this long after asking)
const GAP = 4; // events never closer than this to each other
const HOME_LOT_R = 8; // (the 큰 집's half-diagonal and a step; island-home)
const LOST_KEEP_MS = 15 * 60 * 1000; // a picked-up lost thing not returned by then: the owner gives up (the event ends)
const NPC_KEEP_MS = 25 * 60 * 1000; // an NPC event nobody takes up ends and another starts

// where: the ground it appears on. item: what goes in the bag. points: paid at once. slot counts and cooldowns above are the resource budget.
const TYPES = {
  beach_trash: { name: '해안 쓰레기', verb: '줍기', where: 'shore', item: 'trash', weight: 3 },
  grass_trash: { name: '풀밭 쓰레기', verb: '줍기', where: 'grass', item: 'trash', weight: 3 },
  herb: { name: '희귀 약재', verb: '채집', where: 'woods', item: 'herb', weight: 2 },
  berry: { name: '나무 열매', verb: '따기', where: 'tree', item: 'berry', qty: 1, weight: 2 },
  mushroom: { name: '버섯', verb: '채집', where: 'woods', item: 'mushroom', weight: 2 },
  coin: { name: '떨어진 동전', verb: '줍기', where: 'walkside', points: 2000, weight: 2 }, // v1.10.35 단가 (경제 기준 통합)
  wallet: { name: '잃어버린 지갑', verb: '줍기', where: 'walkside', item: 'wallet', weight: 1 },
  // Q2 사진 부탁 B안 (사용자 「B안으로 가자」, gamecenter-notes docs/interact-quests-20261029.md 1): in a photo spot only; a word
  // first (asked), then a real shot of them from that spot (the photo mode's shutter, them in its frame) -- paid then
  photo: { name: '관광객 사진 부탁', verb: '말 걸기', where: 'view', points: 6000, npc: true, weight: 1 },
  // v1.10.39 섬 전체 할로윈 (IDEAS, 사용자 확정 2026-10-07): in October (Asia/Seoul) candy bags lie about the grass
  candy: { name: '사탕 주머니', verb: '줍기', where: 'grass', item: 'candy', weight: 3, month: 9 },
  lost: { name: '분실물 찾아주기', verb: '줍기', returnVerb: '돌려주기', talkVerb: '말 걸기', where: 'walk', item: 'lost', points: 10000, npc: true, weight: 1 },
};

function createIslandEvents({ random = Math.random, now = () => Date.now(), occupied = () => [] } = {}) {
  const events = new Map(); // id -> event
  let seq = 0; const prefix = require('node:crypto').randomBytes(6).toString('hex');
  const solids = T.natureSolids();
  const spots = T.BUILDINGS; // v1.10.13: the cottages too
  const trees = T.nature().trees;
  const props = T.plazaProps();
  const waitingSolids = [...props.benches, ...props.lamps, ...props.beds, ...(T.structureSolids?.() || []), /* (묶음 1: 대청마당's gardens and channels too) */
    ...Object.values(require('./island-quests').STORIES).map(s=>({...s.at,r:1.7})),
    ...T.RESERVED_LOTS.map(p => ({ x:p.x, z:p.z, r:3.2 }))];
  // The walk lanterns can use either side depending on which prior spots are free on a client.
  // Cover both possible positions and the 5m search rings of field decorations without moving any props.
  // 달마루섬 (5단계): 대청마당 is a rectangle (not a circle at the origin), the island 165 m across, the shore a list
  const nearPlaza = (x, z, m) => (T.inPlaza ? T.inPlaza(x, z, m) : Math.hypot(x, z) < T.PLAZA_R + m);
  const FIELD_R = T.dalmaru ? T.dalmaru.R_OUT : 100;
  const seasonalWaiting = [...T.HALLOWEEN_FIELDS.map(([x,z]) => ({x,z,r:8})),
    ...T.HALLOWEEN_EXTRAS.map(([,x,z]) => ({x,z,r:6})),
    {x:T.POND.x+T.POND.r+1.8,z:T.POND.z,r:6}];
  for (const w of T.walkCurves) for (let i=4;i<w.pts.length-1;i+=10) {
    const [x,z]=w.pts[i], [x2,z2]=w.pts[i+1], len=Math.hypot(x2-x,z2-z)||1;
    if (nearPlaza(x,z,6)) continue;
    for (const side of [-1,1]) seasonalWaiting.push({x:x-(z2-z)/len*(w.w/2+0.7)*side,
      z:z+(x2-x)/len*(w.w/2+0.7)*side,r:0.75});
  }
  const residents = createIslandResidents({ now, random, isSafe: (x,z,away) =>
    !T.onBridge(x,z) && clear(x,z,{away}) &&
    occupied().every(p=>Math.hypot(x-p.x,z-p.z)>=1.4) &&
    waitingSolids.every(s => Math.hypot(x-s.x,z-s.z) >= s.r+0.5) &&
    (!T.isHalloween(now()) || seasonalWaiting.every(s => Math.hypot(x-s.x,z-s.z)>=s.r)) });

  const givers = Object.values(require('./island-quests').STORIES).map((st) => st.at);
  // (Q2 사진 부탁: the tourist in a photo spot -- 대청마당, 게임관 앞 and the rest, which the things-on-the-ground rule keeps
  // clear of; still standable, off the bridge and stairs, clear of people, the waiting ones, the quest givers and other events)
  const photoSafe = (p, away) => Boolean(Fishing.photoSpotAt(p.x, p.z)) && T.walkable(p.x, p.z) && !T.onBridge(p.x, p.z) && !T.onStairs?.(p.x, p.z) &&
    occupied().every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= 1.4) && waitingSolids.every((s) => Math.hypot(p.x - s.x, p.z - s.z) >= s.r + 0.5) &&
    givers.every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= 5) && [...events.values()].every((e) => placesOf(e).every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= GAP)) && (!away || Math.hypot(p.x - away.x, p.z - away.z) >= 15);
  const rnd = (a, b) => a + random() * (b - a);
  const pick = (list) => list[Math.floor(random() * list.length)];

  // Somewhere anything may lie: on standable ground, off the plaza, clear of buildings, trees, bushes, lamps and statues.
  function clear(x, z, { gap = GAP, away = null, nearGivers = false } = {}) {
    if (!T.walkable(x, z) || nearPlaza(x, z, 4) || T.onStairs?.(x, z)) return false;
    for (const s of spots) if (s.kind !== 'townhall' && Math.hypot(x - s.x, z - s.z) < (s.kind === 'hall' ? 14 : s.kind === 'facade' ? 18 : 7)) return false;
    if (T.inTownhall(x, z, 3)) return false; // v1.10.41: the town hall and its walled yard
    // (6회차 5 「집 아래에 물건이」: 툇마루섬's house lots -- a house of any size stands on one -- and the village's buildings)
    for (const l of T.HOME_LOTS || []) if (Math.hypot(x - l.x, z - l.z) < HOME_LOT_R) return false;
    if (T.inVillage?.(x, z)) return false;
    for (const s of T.STATUE_SPOTS) if (Math.hypot(x - s.x, z - s.z) < 3) return false;
    if (!nearGivers) for (const q of givers) if (Math.hypot(x - q.x, z - q.z) < 5) return false; // (not at a quest giver's feet: within reach of her, SPACE picked the thing up instead of talking)
    for (const s of solids) if (!s.skip && Math.abs(x - s.x) < 3 && Math.abs(z - s.z) < 3 && Math.hypot(x - s.x, z - s.z) < s.r + 0.9) return false;
    for (const e of events.values()) for (const p of placesOf(e)) if (Math.hypot(x - p.x, z - p.z) < gap) return false;
    if (away && Math.hypot(x - away.x, z - away.z) < 15) return false; // a new one never where the last one was
    return true;
  }
  const anywhere = () => { const a = rnd(0, Math.PI * 2); const r = Math.sqrt(random()) * FIELD_R; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; };
  // (Q2 사용자 「중앙 만 옆 해변엔 안 나와?」 → 「더 자주 나오게」, notes interact-quests 4: two of the beach's always on 윤슬만's
  // middle beach by 대청마당 -- the bay's rim from -120° to -60° round (0, BAY_Z), about x -47~47)
  const inBay = (p) => { if (!T.dalmaru) return false; const a = (Math.atan2(p.z - T.dalmaru.BAY_Z, p.x) * 180) / Math.PI; return a >= -120 && a <= -60; };
  const shoreAt = (lo, hi, only = null) => { const list = T.shoreSpots().filter((c) => c.cd > lo && c.cd < hi && (!only || only(c))); const c = pick(list); return c ? { x: c.x + rnd(-0.9, 0.9), z: c.z + rnd(-0.9, 0.9) } : null; };
  const onWalk = (edge = false) => {
    const w = pick(T.walkCurves); const i = Math.floor(random() * (w.pts.length - 1)); const [x, z] = w.pts[i]; const [x2, z2] = w.pts[i + 1];
    const l = Math.hypot(x2 - x, z2 - z) || 1; const side = random() < 0.5 ? -1 : 1;
    const off = edge ? w.w / 2 + rnd(0.4, 1.2) : rnd(0, w.w / 2 - 0.4);
    return { x: x - ((z2 - z) / l) * off * side, z: z + ((x2 - x) / l) * off * side };
  };
  const GROUNDS = {
    bayShore: () => shoreAt(2.6, 7, inBay), openShore: () => shoreAt(2.6, 7, (c) => !inBay(c)), // (the bay's two kept two)
    shore: T.shoreSpots ? () => shoreAt(2.6, 7) : () => { const a = rnd(0, Math.PI * 2); const p = { x: Math.cos(a) * (T.coastR(a) - rnd(3, 7)), z: Math.sin(a) * (T.coastR(a) - rnd(3, 7)) }; return T.cliffAt(p.x, p.z) < 0.3 && T.coastDist(p.x, p.z) > 2.6 ? p : null; },
    grass: () => { const p = anywhere(); return T.coastDist(p.x, p.z) > 9 && T.walkDist(p.x, p.z) > 2 ? p : null; },
    woods: () => { const t = pick(trees); const a = rnd(0, Math.PI * 2); const d = rnd(1.8, 3.5); const p = { x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d }; return T.walkDist(p.x, p.z) > 1.5 ? p : null; },
    tree: () => { const used = [...events.values()].filter(e => e.tree).map(e => e.tree); const t = pick(T.harvestTrees().filter(t => !used.some(u => u.x === t.x && u.z === t.z))); return t ? { ...t.approach, tree: t } : null; },
    walk: () => onWalk(false),
    walkside: () => onWalk(true),
    view: T.shoreSpots ? () => shoreAt(4, 9) : () => { const a = rnd(0, Math.PI * 2); const p = { x: Math.cos(a) * (T.coastR(a) - rnd(5, 9)), z: Math.sin(a) * (T.coastR(a) - rnd(5, 9)) }; return T.coastDist(p.x, p.z) > 4 ? p : null; },
  };
  const BAY_TRASH = 2;
  const bayShort = (except) => bayCount(except) < BAY_TRASH; function bayCount(except) { let n = 0; for (const e of events.values()) if (e.type === 'beach_trash' && e !== except && inBay(e)) n += 1; return n; }
  function placeFor(where, away, tries = 300) {
    const ground = where === 'shore' && T.shoreSpots && T.dalmaru ? (bayShort(away) ? 'bayShore' : 'openShore') : where; // (away: the one moved on, itself not counted)
    for (let k = 0; k < tries; k += 1) {
      const p = GROUNDS[ground]();
      if (!p) continue;
      p.x = Math.round(p.x * 100) / 100; p.z = Math.round(p.z * 100) / 100;
      if (where !== 'walk' && T.walkDist(p.x, p.z) < 0.35) continue;
      if (where === 'tree' ? clearNearTree(p, away) : clear(p.x, p.z, { away })) return p;
    }
    return null;
  }
  function clearNearTree(p, away) { // berries hang on their tree's edge: every other rule but that one tree
    const own = p.tree;
    const saved = solids.filter((s) => s.x === own.x && s.z === own.z);
    for (const s of saved) s.skip = true;
    const ok = clear(p.x, p.z, { away, nearGivers: true }); // (a fruit tree stays where it grows)
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
    const id = `e${prefix}${(seq += 1).toString(36)}`;
    const owner = def.npc ? residents.reserve(id, away, type === 'photo' ? photoSafe : null) : null;
    const at = def.npc ? owner : placeFor(def.where, away);
    if (!at) return null;
    const e = { id, type, x: at.x, z: at.z, createdAt: now(), state: 'open', carrier: null, pickedAt: null, generation: 1, tree: at.tree || null };
    if (owner) e.resident = owner.n;
    if (type === 'lost') { // the owner waits on a walk; the thing lies on the grass a little way off
      e.npc = { x: at.x, z: at.z, yaw: at.yaw, resident: owner.n };
      // (6회차 5: an owner waiting on 툇마루섬, its lots now kept clear -- further off when nothing near is free)
      const item = (() => { for (let k = 0; k < 400; k += 1) { const p = k < 200 ? GROUNDS.grass() : (() => { const a = rnd(0, Math.PI * 2); const d = rnd(12, 45); return { x: at.x + Math.cos(a) * d, z: at.z + Math.sin(a) * d }; })(); const d = p && Math.hypot(p.x - at.x, p.z - at.z); if (p && d > 12 && d < (k < 200 ? 32 : 45) && T.coastDist(p.x, p.z) > 3 && T.walkDist(p.x, p.z) > 2 && clear(p.x, p.z)) return p; } return null; })();
      if (!item) { residents.release(e.id); return null; }
      e.x = Math.round(item.x * 100) / 100; e.z = Math.round(item.z * 100) / 100;
    } else if (type === 'photo') { e.npc = { x: at.x, z: at.z, yaw: at.yaw, resident: owner.n }; e.spot = Fishing.photoSpotAt(at.x, at.z).id; }
    events.set(e.id, e);
    return e;
  }
  function fill(away = null) {
    for (const [type, amount] of Object.entries(RESOURCE_COUNTS).sort(([a],[b]) => (a === 'berry' ? -1 : b === 'berry' ? 1 : 0))) {
      if (!inSeason(TYPES[type])) continue;
      for (let guard = 0; count(type) < amount && guard < amount * 10; guard++) spawn(away, type);
    }
    for (let guard = 0; npcCount() < NPC_ACTIVE && guard < 40; guard++) spawn(away);
  }
  // Time limits: an NPC event nobody takes up, and a lost thing never returned, end; the slot is filled again.
  function expire() {
    const t = now(); const gone = [];
    for (const e of events.values()) {
      if (!inSeason(TYPES[e.type])) { if (!e.busy) { events.delete(e.id); residents.release(e.id); gone.push(e.id); } continue; } // October's candy gone in November
      if (!TYPES[e.type].npc) {
        if (e.state === 'growing' && t >= e.readyAt && !e.busy) {
          const at = e.tree ? e : placeFor(TYPES[e.type].where, e);
          if (at) { e.x = at.x; e.z = at.z; e.state = 'open'; e.generation++; delete e.readyAt; }
        }
        continue;
      }
      if (!e.busy && ((e.state === 'carried' && t - e.pickedAt > LOST_KEEP_MS) || (e.state === 'open' && t - e.createdAt > NPC_KEEP_MS))) { events.delete(e.id); residents.release(e.id); gone.push(e.id); }
    }
    if (gone.length) fill();
    else if (npcCount() < NPC_ACTIVE) spawn(); // a previously unsafe resident can become available on a later pose
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
        if (Math.hypot(e.npc.x - x, e.npc.z - z) <= NEAR) out.push({ id: e.id, kind: 'lost_owner', x: e.npc.x, z: e.npc.z, resident: e.resident, yaw: e.npc.yaw, verb: e.state === 'carried' ? (e.carrier === account ? def.returnVerb : null) : def.talkVerb });
        // v1.10.32 운반: the thing I carry, wherever I am (held in my hands; its owner's place for the map)
        if (e.state === 'carried' && e.carrier === account) out.push({ id: e.id, kind: 'carrying', x: e.npc.x, z: e.npc.z, verb: null });
        continue;
      }
      if (e.type === 'photo') { if (Math.hypot(e.x - x, e.z - z) <= NEAR) { const asked = Boolean(e.asked?.has(account)); out.push({ id: e.id, kind: 'photo', x: e.x, z: e.z, resident: e.resident, yaw: e.npc.yaw, name: def.name, available: true, asked, spot: Fishing.PHOTO_SPOTS.find((s) => s.id === e.spot)?.name || null, verb: asked ? null : def.verb }); } continue; } // (asked: the photo mode's turn)
      if (Math.hypot(e.x - x, e.z - z) <= NEAR && (def.npc || e.state === 'open' || e.tree)) out.push({ id: e.id, kind: e.type, x: e.x, z: e.z, resident: e.resident, yaw: e.npc?.yaw, name: def.name, resource: !def.npc, available: e.state === 'open', generation: e.generation, tree: e.tree, verb: e.state === 'open' ? def.verb : null });
    }
    return out;
  }

  // Taking an event, step one (synchronous, so two players can never both take it): what to do, or why not.
  function claim(id, account, pos, { owner = false, shot = false } = {}) {
    const e = events.get(id);
    if (!e || e.state === 'growing') return { error: 'GONE' };
    const def = TYPES[e.type];
    if (e.type === 'photo') { // (Q2: asked by me, 2 s on, from the same photo spot, within 12 m of them -- what the screen saw in its frame)
      if (!pos || Math.hypot(pos.x - e.npc.x, pos.z - e.npc.z) > (shot ? PHOTO_RANGE : REACH)) return { error: shot ? 'PHOTO_FAR' : 'TOO_FAR' };
      if (e.busy) return { error: 'GONE' }; const asked = (e.asked ||= new Map());
      if (!shot) { if (!asked.has(account)) asked.set(account, now()); return { event: e, action: 'photoAsk', spot: Fishing.PHOTO_SPOTS.find((s) => s.id === e.spot)?.name || null }; }
      if (!asked.has(account)) return { error: 'NOT_ASKED' };
      if (now() - asked.get(account) < PHOTO_POSE_MS) return { error: 'TOO_SOON' };
      if (Fishing.photoSpotAt(pos.x, pos.z)?.id !== e.spot) return { error: 'OFF_SPOT' };
      e.busy = true; return { event: e, action: 'points', points: def.points, title: def.name };
    }
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
    if (!TYPES[e.type].npc) { e.state = 'growing'; e.readyAt = now() + REGEN_MS[e.type]; return { removed: e.id }; }
    events.delete(e.id);
    residents.release(e.id, claimed.action === 'return' ? 2100 : 0);
    const away = { x: e.x, z: e.z };
    fill(away);
    return { removed: e.id };
  }
  // v1.10.32: the lost thing an account carries (its id), for everyone's view of that player
  const carryOf = (account) => { for (const e of events.values()) if (e.type === 'lost' && e.state === 'carried' && e.carrier === account) return e.id; return null; };
  // tests only (server NODE_ENV=test): the NPC event made a lost thing, so the carry and the giving back can be walked
  function spawnLost(type = 'lost') { // (tests: a lost thing's owner -- or, Q2, the tourist -- now; null when no islander is where it may be)
    for (const e of [...events.values()]) if (TYPES[e.type].npc && e.state === 'open') { events.delete(e.id); residents.release(e.id); }
    for (let k = 0; k < 40; k += 1) { const e = spawn(null, type); if (e) return e; }
    return null;
  }
  const activeLost = () => [...events.values()].filter((e) => e.type === 'lost').map((e) => e.id);

  fill();
  // (tests only: the events that hold a resident end, so a test of residents does not depend on what earlier tests left)
  function freeResidents() { const gone = []; for (const [id, e] of events) if (TYPES[e.type]?.npc && !e.busy) { events.delete(id); residents.release(id); gone.push(id); } return gone; }
  return { events, nearby, claim, settle, expire, fill, activeLost, carryOf, spawnLost, freeResidents, residents: () => residents.snapshot(), residentTalk: residents.talk, residentKeep: residents.keep, residentBye: (who) => residents.release(who), residentTalking: residents.talkOf, size: () => events.size };
}

module.exports = { RESOURCE_COUNTS, REGEN_MS, createIslandEvents, seoulMonth, TYPES, ACTIVE, NPC_ACTIVE, NEAR, REACH, GAP };
