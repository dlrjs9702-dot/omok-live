'use strict';

// v1.10.91 주민 심부름 (사용자 2026-10-18): islanders ask for each other -- someone is looking for someone, or has a
// thing to be taken to someone. Three a day (Seoul), the same for everyone, each once per account and day. Pure: the
// server keeps where each account is in an errand (stage) and pays the end once (claimEvent). v1.10.92 잡화점: "buy me
// this at the store" (kind 'buy': the good from the bag to the asker, paid its price and a bonus).
const Cast = require('../public/plaza/island-cast');
const Npcs = require('../public/plaza/island-npcs');

const Ores = require('./island-ores');
const MAT_LINES = require('./errands-material.json'); // (366 「재료 부탁」: each islander's ask · why · thanks, notes content-20261118)

const PER_DAY = 3;
const REWARD = { find: 2000, deliver: 1500, buy: 1500, material: 2000 }; // (buy, material: on top of the goods' price)
// 366 「재료 부탁」 (총괄: the new ores and gems are what is asked for; star fragments too): one more errand every day, an
// islander out walking that day wants some of a material from my bag -- `cat` picks their why line; `w` how often
const MATERIALS = Object.freeze([
  ...Ores.ORES.filter((o) => o.tier <= 1 && o.id !== 'granite').map((o) => ({ id: `ore_${o.id}`, name: o.name, cat: 'ore', count: o.tier === 0 ? [3, 5] : [2, 4], w: 55 / 9 })),
  ...Ores.ORES.filter((o) => o.tier >= 2).map((o) => ({ id: `ore_${o.id}`, name: o.name, cat: 'rare', count: o.tier === 2 ? [1, 2] : [1, 1], w: 30 / 5 })),
  ...Ores.GEMS.map((g) => ({ id: `gem_${g.id}`, name: g.name, cat: 'rare', count: [1, 1], w: g.rare ? 1 : 2 })),
  { id: 'star_fragment', name: '별 조각', cat: 'star', count: [1, 2], w: 10 },
].map((m) => Object.freeze(m)));
const matLines = (n) => MAT_LINES.find((x) => x.name === Cast.RESIDENTS[n].name) || MAT_LINES[0];
const fillMat = (line, e) => line.replace(/\{item\}/g, e.thing).replace(/\{count\}/g, String(e.count));
// how many of an item I carry: a Map of counts (the server's), or a Set (one each)
const has = (bag, id, n = 1) => (bag instanceof Map ? (bag.get(id) || 0) >= n : bag.has(id) && n <= 1);
const BUY_GOODS = ['bread', 'milk', 'bouquet', 'letter_paper', 'bulb', 'paint', 'guitar_string', 'nail_box'];
const GOOD_NAME = { bread: '빵 봉투', milk: '우유', bouquet: '꽃다발', letter_paper: '편지지', bulb: '전구', paint: '물감', guitar_string: '기타 줄', nail_box: '못 상자' };
const THINGS = ['편지', '도시락', '우산', '손수건', '쪽지', '빵 봉투', '꽃 한 송이', '열쇠'];
const FIND_WHY = ['빌려 간 책을 돌려받아야 하거든요', '꼭 할 말이 있는데 어디 갔는지 모르겠어요', '같이 산책하기로 했는데 안 보여요', '맛있는 걸 나눠 주고 싶은데 안 보이네요'];
const { josa } = Cast;
const nameOf = (n) => Cast.RESIDENTS[n].name;

const seeded = (text) => { let s = 2166136261; for (const ch of text) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
// 묶음 1 멀리 심부름 (gamecenter-notes residents-talk-hills-20261018.md 4): the one to find or bring to lives far from the
// asker -- one of the three farthest (the hills' islanders, mostly) -- with a little more for each step of the way
// (`far`: 0 under 60 m apart, 1 under 120, 2 beyond; economy `errand:far` each), and the asker says where they are
// usually seen (`where`, the 섬 소문's words): no mark on the map or the compass
const apart = (a, b) => { const p = Npcs.homeOf(a); const q = Npcs.homeOf(b); return Math.hypot(p.x - q.x, p.z - q.z); };
// the day's errands: different askers, someone else to find or bring to -- v1.10.220 (C2 결정 1): among the islanders out
// walking that day (`walking(n)`: the server's walksToday -- IslandRoster.walks on the day; left out, the ten as before), so
// every asker and every one sought is out there
function errandsOf(day, walking = (n) => n < Cast.WALKERS.length) {
  const list = Cast.RESIDENTS.map((_, n) => n).filter((n) => walking(n));
  const rnd = seeded(`errand:${day}`); const used = new Set(); const out = [];
  for (let k = 0; k < PER_DAY; k += 1) {
    let from; do from = list[Math.floor(rnd() * list.length)]; while (used.has(from));
    used.add(from);
    const far = list.filter((n) => n !== from).sort((a, b) => apart(from, b) - apart(from, a)).slice(0, 3);
    const to = far[Math.floor(rnd() * far.length)];
    const r = rnd(); const kind = r < 0.34 ? 'find' : r < 0.67 || out.some((e) => e.kind === 'buy') ? 'deliver' : 'buy'; // (one store errand a day at most)
    const good = kind === 'buy' ? BUY_GOODS[Math.floor(rnd() * BUY_GOODS.length)] : null;
    const d = kind === 'buy' ? 0 : apart(from, to);
    out.push(Object.freeze({ id: `errand_${day.replace(/-/g, '')}_${k}`, kind, from, to: kind === 'buy' ? from : to, reward: REWARD[kind], good, far: d < 60 ? 0 : d < 120 ? 1 : 2, where: kind === 'buy' ? null : Npcs.hangout(to),
      thing: kind === 'deliver' ? THINGS[Math.floor(rnd() * THINGS.length)] : good ? GOOD_NAME[good] : null, why: kind === 'find' ? FIND_WHY[Math.floor(rnd() * FIND_WHY.length)] : null }));
  }
  // (366 재료 부탁: its own seed -- the three above as they were; an asker not already asking)
  const mr = seeded(`material:${day}`); const free = list.filter((n) => !used.has(n));
  if (free.length) {
    const from = free[Math.floor(mr() * free.length)]; const sum = MATERIALS.reduce((s, m) => s + m.w, 0); let t = mr() * sum; const m = MATERIALS.find((x) => (t -= x.w) < 0) || MATERIALS[0];
    const count = m.count[0] + Math.floor(mr() * (m.count[1] - m.count[0] + 1)); const say = Math.floor(mr() * 2);
    out.push(Object.freeze({ id: `errand_${day.replace(/-/g, '')}_m`, kind: 'material', from, to: from, reward: REWARD.material, good: m.id, count, cat: m.cat, far: 0, where: null, thing: m.name, why: null, say }));
  }
  return out;
}
const title = (e) => (e.kind === 'find' ? `${nameOf(e.to)} 찾아 주기` : e.kind === 'buy' ? `${nameOf(e.from)}에게 ${e.thing} 사다 주기` : e.kind === 'material' ? `${nameOf(e.from)}에게 ${e.thing} ${e.count}개 갖다 주기` : `${nameOf(e.to)}에게 ${e.thing} 전하기`);
const label = (e) => (e.kind === 'find' ? `${nameOf(e.to)} 찾기 → ${nameOf(e.from)}에게 알리기` : e.kind === 'buy' ? `잡화점 ${e.thing} → ${nameOf(e.from)}` : e.kind === 'material' ? `${e.thing} ${e.count}개 → ${nameOf(e.from)}` : `${e.thing} → ${nameOf(e.to)}`);
// (366) a 재료 부탁's lines, the asker's own: the ask and why; again, the other ask; the thanks
const matSay = (e, key) => { const L = matLines(e.from); return key === 'ask' ? [fillMat(L.ask[e.say % L.ask.length], e), L.why[e.cat] || ''].filter(Boolean) : key === 'remind' ? [fillMat(L.ask[(e.say + 1) % L.ask.length], e)] : [fillMat(L.thanks[e.say % L.thanks.length], e)]; };

// stage: 0 not asked yet, 1 asked (go to `to`), 2 found (find: back to `from`), 3 done
// talking to walker n with these stages ({[errand id]: stage}) and `done` (ids already paid) ->
// { stages, say: [lines], pay: errand | null, took: errand | null, offer: errand | null }; null when n has nothing to do
// with today's errands. Q 부탁 받기 (docs/quest-accept-complete-20261026.md): a new ask is only offered (`offer`, the stages
// as they were) -- it starts with 「할게요!」 (accept); 「다음에요」 keeps nothing, so it is asked again
// `bag`: the goods I carry (a Set of item ids; a 'buy' errand takes its good -- `take`)
function talk(errands, stages, done, n, bag = new Set()) {
  const st = (e) => (done.has(e.id) ? 3 : stages[e.id] || 0);
  const set = (e, v) => ({ ...stages, [e.id]: v });
  const A = (e) => Cast.callOf(e.from); const B = (e) => Cast.callOf(e.to); // (v1.10.193: in their words, how they call them)
  // (T 주민 말투: every line in the speaking walker's own words; 묶음 1: where one is seen, in words, never a mark on the map)
  const vars = (e) => ({ thing: e.thing, who: B(e), from: A(e), where: e.where, why: Cast.whyOf(n, FIND_WHY.indexOf(e.why)) });
  const say = (e, key) => Cast.say(n, key, vars(e), () => 0);
  for (const e of errands) { // v1.10.92: the good bought for them (366: the materials, so many)
    if ((e.kind !== 'buy' && e.kind !== 'material') || e.from !== n || st(e) !== 1 || !has(bag, e.good, e.count || 1)) continue;
    return { stages: set(e, 3), pay: e, took: null, take: e.good, ...(e.kind === 'material' ? { takeQty: e.count } : {}), say: e.kind === 'material' ? matSay(e, 'thanks') : say(e, 'got_buy') };
  }
  for (const e of errands) { // a thing brought, or someone found (the one I was sent to)
    if (e.to !== n || st(e) !== 1 || e.kind === 'buy' || e.kind === 'material') continue;
    if (e.kind === 'deliver') return { stages: set(e, 3), pay: e, took: null, say: say(e, 'got_deliver') };
    return { stages: set(e, 2), pay: null, took: null, say: say(e, 'found_me') };
  }
  for (const e of errands) { // the asker, told
    if (e.from !== n || e.kind !== 'find' || st(e) !== 2) continue;
    return { stages: set(e, 3), pay: e, took: null, say: say(e, 'found_back') };
  }
  for (const e of errands) { // a new ask, or a reminder
    if (e.from !== n) continue;
    const s = st(e);
    if (e.kind === 'material' && (s === 0 || s === 1)) return { stages, pay: null, took: null, ...(s === 0 ? { offer: e } : {}), say: matSay(e, s === 0 ? 'ask' : 'remind') };
    if (s === 0) return { stages, pay: null, took: null, offer: e,
      say: say(e, e.kind === 'buy' ? 'ask_buy' : [e.kind === 'find' ? 'ask_find' : 'ask_deliver', ...(e.where ? ['hint'] : [])]) };
    if (s === 1) return { stages, pay: null, took: null, say: say(e, e.kind === 'buy' ? 'remind_buy' : e.kind === 'find' ? (e.where ? 'remind_find_where' : 'remind_find') : 'remind_deliver') };
    if (s === 2) return null; // (handled above)
  }
  return null;
}
// (Q) 「할게요!」 to walker n's offered errand `id` -> { stages, took, say } | null (not theirs, or not waiting to be asked);
// 「그만둘래요」 an errand under way -> the stages with it not asked again (the asker offers it once more)
function accept(errands, stages, done, n, id) {
  const e = errands.find((x) => x.id === id && x.from === n);
  if (!e || done.has(e.id) || (stages[e.id] || 0) !== 0) return null;
  return { stages: { ...stages, [e.id]: 1 }, took: e, say: Cast.say(n, 'errandYes', {}, () => 0) };
}
function drop(errands, stages, done, id) {
  const e = errands.find((x) => x.id === id);
  if (!e || done.has(e.id) || ![1, 2].includes(stages[e.id])) return null;
  return { ...stages, [e.id]: 0 };
}
// what a walker shows over their head for me: 'new' (an ask waiting), 'ready' (I bring news or a thing to them)
function marks(errands, stages, done, bag = new Set()) {
  const st = (e) => (done.has(e.id) ? 3 : stages[e.id] || 0);
  const out = {};
  for (const e of errands) {
    if (st(e) === 0 && out[e.from] == null) out[e.from] = 'new';
    if (st(e) === 1 && ((e.kind !== 'buy' && e.kind !== 'material') || has(bag, e.good, e.count || 1))) out[e.to] = 'ready';
    if (e.kind === 'find' && st(e) === 2) out[e.from] = 'ready';
  }
  return out;
}
// the errands under way (the tracker line)
function track(errands, stages, done) {
  return errands.filter((e) => !done.has(e.id) && (stages[e.id] === 1 || stages[e.id] === 2))
    .map((e) => ({ id: e.id, title: title(e), label: label(e), to: stages[e.id] === 2 ? e.from : e.to, reward: e.reward }));
}

module.exports = { PER_DAY, REWARD, BUY_GOODS, MATERIALS, errandsOf, talk, accept, drop, marks, track, title };
