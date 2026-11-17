// v1.10.318 마당 농사 F1 + 집 손보기 (gamecenter-notes docs/yard-farming-20261109.md 「추천안대로」, docs/gather-must-ideas-20261114.md
// 사용자 1A 2A 3B): the rules the server and the page share.
// - 텃밭 (assets 115 farm_bed: 2 × 3 soil cells, its slots 0.9 m apart): a seed a cell, four stages by the server clock (planted,
//   sprouted, growing, ripe -- each a third of the crop's time), compost or fertilizer once a cell (the rest twice as fast), ripe:
//   picked into the bag. How many beds a yard holds: by its level.
// - 집 손보기: each week (Monday 00:00 Asia/Seoul) a house owner owes weeds, twigs (either kind) and small stones -- more for a
//   bigger house; put in the box by the door. A week missed: the house 「허름함」 (looks only) until the next one is done.
// - 재료로 쓰기: weeds into compost, stones into stepping stones, branches into a fence piece.
// - 내 마당 잡초: a few a day grow in a house's yard (its owner's days away), up to a dozen; anyone may pull them.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandFarm = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const H = 3600000;
  // 작물 6종 (사용자 「추천안대로」 2026-11-09): its time to ripe, how many come off a cell, the seed's price and the crop's (경제 값
  // 표 good:seed_* / item:crop_*: a cell earns less than a fish, a bed of six a few thousand -- a waiting game)
  const CROPS = Object.freeze({
    carrot: { name: '당근', icon: '🥕', growMs: 12 * H, yield: 3, seed: 300, price: 260 },
    potato: { name: '감자', icon: '🥔', growMs: 24 * H, yield: 3, seed: 500, price: 420 },
    tomato: { name: '토마토', icon: '🍅', growMs: 24 * H, yield: 2, seed: 500, price: 650 },
    corn: { name: '옥수수', icon: '🌽', growMs: 48 * H, yield: 2, seed: 800, price: 1000 },
    pumpkin: { name: '호박', icon: '🎃', growMs: 48 * H, yield: 1, seed: 800, price: 2400 },
    cabbage: { name: '양배추', icon: '🥬', growMs: 12 * H, yield: 1, seed: 300, price: 900 },
  });
  const ORDER = Object.freeze(Object.keys(CROPS));
  const seedId = (crop) => `seed_${crop}`; const cropId = (crop) => `crop_${crop}`;
  const cropOfSeed = (id) => { const m = /^seed_([a-z]+)$/.exec(String(id || '')); return m && CROPS[m[1]] ? m[1] : null; };
  // the bed: its six cells' places (bed-local, the soil's height 0.12) -- seen from its front (-Z), the near row left to right
  // first (assets 115 slots-top.png: the left of one facing +Z is +X)
  const SLOTS = Object.freeze([[0.9, -0.45], [0, -0.45], [-0.9, -0.45], [0.9, 0.45], [0, 0.45], [-0.9, 0.45]].map(([x, z]) => Object.freeze({ x, y: 0.12, z })));
  const BEDS = Object.freeze([2, 3, 4]); // (yard level 1..3 -- 「마당 크기에 따라 2~4개」)
  const bedsFor = (level) => BEDS[Math.min(BEDS.length, Math.max(1, Number(level) || 1)) - 1];
  // a cell's stage now (0 planted .. 3 ripe): its time a third a stage, the part after compost twice as fast
  function stageOf(cell, now) {
    const c = cell && CROPS[cell.crop]; if (!c || !Number.isFinite(cell.at)) return -1;
    const f = Number.isFinite(cell.fed) && cell.fed > cell.at ? Math.min(now, cell.fed) : null;
    const grown = f === null ? now - cell.at : (f - cell.at) + 2 * Math.max(0, now - f);
    return Math.max(0, Math.min(3, Math.floor(grown / (c.growMs / 3))));
  }
  const ripe = (cell, now) => stageOf(cell, now) === 3;
  // when it is ripe (server time)
  function ripeAt(cell) {
    const c = cell && CROPS[cell.crop]; if (!c) return null; const f = Number.isFinite(cell.fed) && cell.fed > cell.at ? cell.fed : null;
    if (f === null || f - cell.at >= c.growMs) return cell.at + c.growMs;
    return f + (c.growMs - (f - cell.at)) / 2;
  }
  // 「3시간 5분」 for the time left (whole minutes, rounded up: never 「60분」)
  function leftWord(ms) { const all = Math.max(1, Math.ceil(ms / 60000)); const h = Math.floor(all / 60); const m = all % 60; return `${h ? `${h}시간` : ''}${h && m ? ' ' : ''}${m || !h ? `${m}분` : ''}`; }

  // 집 손보기 (사용자 1A 한 주 양, 2A 집 크기에 따라): each week's owing, 큰 집 ×1.5, 2층 큰 집 ×2 (rounded up)
  const UPKEEP = Object.freeze({ weed: 30, twig: 10, stone: 5, ore: 5 }); // (1.10.323 채석장, 사용자 29B·30A: 광석 5 a week, from the quarry's opening)
  const UPKEEP_NAMES = Object.freeze({ weed: '잡초', twig: '나뭇가지', stone: '작은 돌', ore: '화강암' }); /* (1.10.342 review-plan §1-9: the 광석 5 is 화강암 -- the one mined before the eight kinds still counts) */
  const UPKEEP_ITEMS = Object.freeze({ weed: ['weed'], twig: ['branch', 'twig'], stone: ['stone'], ore: ['ore_granite', 'ore'] }); // (the bag's items each counts)
  const upkeepScale = (stage) => (stage >= 4 ? 2 : stage === 3 ? 1.5 : 1);
  const upkeepNeed = (stage) => Object.fromEntries(Object.entries(UPKEEP).map(([k, n]) => [k, Math.ceil(n * upkeepScale(stage))]));
  const upkeepDone = (given, need) => Object.keys(need).every((k) => (given?.[k] || 0) >= need[k]);
  // the week: its Monday (Asia/Seoul) as YYYY-MM-DD
  function weekOf(now) {
    const kst = new Date(now + 9 * H); const dow = (kst.getUTCDay() + 6) % 7; const mon = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - dow));
    return mon.toISOString().slice(0, 10);
  }
  const dayOf = (now) => new Date(now + 9 * H).toISOString().slice(0, 10);
  const prevWeek = (week) => new Date(Date.parse(`${week}T00:00:00Z`) - 7 * 24 * H).toISOString().slice(0, 10);
  // the house's state from the upkeep record { week, given, done: [weeks done] } at `now`: this week's owing and given, and
  // 허름함 when the week before was owed and not done (first week of a new house: owed from the next)
  // 1.10.348 4b (notes gather-must-ideas §64·81A, 사용자 2026-11-16): the house's wear -- each owed week not done (logged in or not, 80B)
  // one step down, from the week it was turned on (the old 허름함 its start); the week's upkeep only holds it; repair takes it up
  const WEAR = Object.freeze(['깨끗함', '허름함', '낡음', '부서짐']); const WEAR_MAX = 3; /* (4 압류 · 5 처분: 4c) */
  const nextWeek = (week) => new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 24 * H).toISOString().slice(0, 10);
  function wearOf(doc, now) {
    const week = weekOf(now); const done = new Set(doc?.done || []); const since = doc?.since || week;
    if (!doc?.levelWeek) return { level: since < week && !done.has(prevWeek(week)) && !done.has(week) ? 1 : 0, levelWeek: week, dropped: [] }; /* (its first look: as 허름함 was) */
    let level = Math.max(0, Math.min(WEAR_MAX, Number(doc.level) || 0)); const dropped = [];
    for (let w = doc.levelWeek; w < week; w = nextWeek(w)) if (w >= since && !done.has(w) && level < WEAR_MAX) { level += 1; dropped.push({ week: w, level }); }
    return { level, levelWeek: week, dropped };
  }
  // 81A: up one step from each -- before the new island its 통나무 asked as twice the 나뭇가지; 143A: things bought at the 벼룩시장 count
  const REPAIR = Object.freeze({ 1: { items: { twig: 10, stone: 10 } }, 2: { items: { granite: 10, iron: 3, log: 5 } }, 3: { items: { granite: 20, iron: 10, log: 10 }, points: 20000 } });
  const REPAIR_ITEMS = Object.freeze({ twig: ['branch', 'twig'], stone: ['stone'], granite: ['ore_granite', 'ore'], iron: ['ore_iron'], log: ['log'] });
  const REPAIR_NAMES = Object.freeze({ twig: '나뭇가지', stone: '작은 돌', granite: '화강암', iron: '철광석', log: '통나무' });
  function repairNeed(level, logs = false) { const r = REPAIR[level]; if (!r) return null; const items = { ...r.items }; if (!logs && items.log) { items.twig = (items.twig || 0) + items.log * 2; delete items.log; } return { items, points: r.points || 0 }; }
  // 4b the look (assets 139 decay-v1): 낡음 / 부서짐 laid over the house (압류 in 4c); what it blocks, in the house's own frame
  // (139 solids.json: the leaning fence's three circles, 압류 the rope's posts and line before the steps); 145 바퀴벌레 each level
  const decayOf = (level) => (level >= 5 ? null : level >= 4 ? 'seized' : level >= 3 ? 'broken' : level >= 2 ? 'worn' : null);
  const DECAY_FENCE = Object.freeze({ hut: [[-2.554, -2.509], [-2.121, -2.588], [-1.689, -2.667]], house: [[-2.972, -3.208], [-2.421, -3.308], [-1.871, -3.408]], manor: [[-5.222, -5.608], [-4.671, -5.708], [-4.121, -5.808]], manor2: [[-5.222, -5.608], [-4.671, -5.708], [-4.121, -5.808]] });
  const DECAY_ROPE_Z = Object.freeze({ hut: -2.9, house: -3.9, manor: -6.15, manor2: -6.15 });
  function decaySolids(size, decay) { /* [[x, z, r]] -- the house's frame */
    if (!decay || !DECAY_FENCE[size]) return [];
    const out = DECAY_FENCE[size].map(([x, z]) => [x, z, 0.32]);
    if (decay === 'seized') { const z = DECAY_ROPE_Z[size]; out.push([-1.05, z, 0.16], [1.05, z, 0.16], ...[-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((x) => [x, z, 0.13])); }
    return out;
  }
  const BUGS = Object.freeze([0, 3, 8, 15, 25, 25]);
  function upkeepState(doc, stage, now) {
    const week = weekOf(now); const need = upkeepNeed(stage); const given = doc?.week === week ? { ...doc.given } : {};
    const done = new Set(doc?.done || []); const { level } = wearOf(doc, now);
    return { week, need, given, done: done.has(week), level, wear: WEAR[level], shabby: level >= 1, worn: level >= 2, broken: level >= 3, repair: repairNeed(level) };
  }

  // 재료로 쓰기 (사용자 3B): what goes in, what comes out (a bag item, or a yard good into the 가구 창고)
  const CRAFTS = Object.freeze({
    compost: { name: '퇴비', takes: { weed: 3 }, item: 'compost', note: '텃밭 한 칸을 두 배 빨리' },
    stepping_stones: { name: '징검돌', takes: { stone: 6 }, good: 'yard_stepping_stones__plain', note: '마당 물건' },
    fence_wood: { name: '나무 울타리', takes: { branch: 4 }, good: 'yard_fence_wood__plain', note: '마당 물건' },
  });

  // 내 마당 잡초 (사용자 3B): GROW a day (00:00 Asia/Seoul), up to MAX; their places in the yard's own ground (lot-local),
  // the same for the same lot and day -- `free(lx, lz)` says a spot is the yard's
  const YARD_WEEDS = Object.freeze({ GROW: 3, MAX: 12, MANY: 8 });
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // the weeds after growing from `last` (a day, YYYY-MM-DD) to `today`: the list plus the new ones, at most MAX
  function growYardWeeds(list, lotId, last, today, box, free) {
    const out = (list || []).slice(); if (!last || last >= today) return out;
    const days = Math.min(5, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / (24 * H)));
    for (let d = days - 1; d >= 0 && out.length < YARD_WEEDS.MAX; d -= 1) {
      const day = new Date(Date.parse(`${today}T00:00:00Z`) - d * 24 * H).toISOString().slice(0, 10); const r = rng(hash(`${lotId}:${day}`));
      for (let k = 0, made = 0; k < 60 && made < YARD_WEEDS.GROW && out.length < YARD_WEEDS.MAX; k += 1) {
        const lx = Math.round((box[0] + r() * (box[1] - box[0])) * 100) / 100; const lz = Math.round((box[2] + r() * (box[3] - box[2])) * 100) / 100;
        if (!free(lx, lz) || out.some((w) => Math.hypot(w.lx - lx, w.lz - lz) < 1)) continue;
        out.push({ id: `${day}-${made}`, lx, lz }); made += 1;
      }
    }
    return out;
  }

  return { CROPS, ORDER, seedId, cropId, cropOfSeed, SLOTS, BEDS, bedsFor, stageOf, ripe, ripeAt, leftWord, UPKEEP, UPKEEP_NAMES, UPKEEP_ITEMS, upkeepNeed, upkeepScale, upkeepDone, upkeepState, WEAR, WEAR_MAX, wearOf, REPAIR, REPAIR_ITEMS, REPAIR_NAMES, repairNeed, decayOf, decaySolids, BUGS, nextWeek, weekOf, dayOf, prevWeek, CRAFTS, YARD_WEEDS, growYardWeeds };
}));
