'use strict';

// v1.10.91 주민 심부름 (사용자 2026-10-18): islanders ask for each other -- someone is looking for someone, or has a
// thing to be taken to someone. Three a day (Seoul), the same for everyone, each once per account and day. Pure: the
// server keeps where each account is in an errand (stage) and pays the end once (claimEvent). v1.10.92 잡화점: "buy me
// this at the store" (kind 'buy': the good from the bag to the asker, paid its price and a bonus).
const Cast = require('../public/plaza/island-cast');
const Npcs = require('../public/plaza/island-npcs');

const PER_DAY = 3;
const REWARD = { find: 2000, deliver: 1500, buy: 1500 }; // (buy: on top of the good's price)
const BUY_GOODS = ['bread', 'milk', 'bouquet', 'letter_paper', 'bulb', 'paint', 'guitar_string', 'nail_box'];
const GOOD_NAME = { bread: '빵 봉투', milk: '우유', bouquet: '꽃다발', letter_paper: '편지지', bulb: '전구', paint: '물감', guitar_string: '기타 줄', nail_box: '못 상자' };
const THINGS = ['편지', '도시락', '우산', '손수건', '쪽지', '빵 봉투', '꽃 한 송이', '열쇠'];
const FIND_WHY = ['빌려 간 책을 돌려받아야 하거든요', '꼭 할 말이 있는데 어디 갔는지 모르겠어요', '같이 산책하기로 했는데 안 보여요', '맛있는 걸 나눠 주고 싶은데 안 보이네요'];
const { josa } = Cast;
const nameOf = (n) => Cast.WALKERS[n].name;

const seeded = (text) => { let s = 2166136261; for (const ch of text) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
// 묶음 1 멀리 심부름 (gamecenter-notes residents-talk-hills-20261018.md 4): the one to find or bring to lives far from the
// asker -- one of the three farthest (the hills' islanders, mostly) -- with a little more for each step of the way
// (`far`: 0 under 60 m apart, 1 under 120, 2 beyond; economy `errand:far` each), and the asker says where they are
// usually seen (`where`, the 섬 소문's words): no mark on the map or the compass
const apart = (a, b) => { const p = Npcs.homeOf(a); const q = Npcs.homeOf(b); return Math.hypot(p.x - q.x, p.z - q.z); };
// the day's errands: different askers, someone else to find or bring to
function errandsOf(day) {
  const rnd = seeded(`errand:${day}`); const used = new Set(); const out = [];
  for (let k = 0; k < PER_DAY; k += 1) {
    let from; do from = Math.floor(rnd() * Cast.WALKERS.length); while (used.has(from));
    used.add(from);
    const far = Cast.WALKERS.map((_, n) => n).filter((n) => n !== from).sort((a, b) => apart(from, b) - apart(from, a)).slice(0, 3);
    const to = far[Math.floor(rnd() * far.length)];
    const r = rnd(); const kind = r < 0.34 ? 'find' : r < 0.67 || out.some((e) => e.kind === 'buy') ? 'deliver' : 'buy'; // (one store errand a day at most)
    const good = kind === 'buy' ? BUY_GOODS[Math.floor(rnd() * BUY_GOODS.length)] : null;
    const d = kind === 'buy' ? 0 : apart(from, to);
    out.push(Object.freeze({ id: `errand_${day.replace(/-/g, '')}_${k}`, kind, from, to: kind === 'buy' ? from : to, reward: REWARD[kind], good, far: d < 60 ? 0 : d < 120 ? 1 : 2, where: kind === 'buy' ? null : Npcs.hangout(to),
      thing: kind === 'deliver' ? THINGS[Math.floor(rnd() * THINGS.length)] : good ? GOOD_NAME[good] : null, why: kind === 'find' ? FIND_WHY[Math.floor(rnd() * FIND_WHY.length)] : null }));
  }
  return out;
}
const title = (e) => (e.kind === 'find' ? `${nameOf(e.to)} 찾아 주기` : e.kind === 'buy' ? `${nameOf(e.from)}에게 ${e.thing} 사다 주기` : `${nameOf(e.to)}에게 ${e.thing} 전하기`);
const label = (e) => (e.kind === 'find' ? `${nameOf(e.to)} 찾기 → ${nameOf(e.from)}에게 알리기` : e.kind === 'buy' ? `잡화점 ${e.thing} → ${nameOf(e.from)}` : `${e.thing} → ${nameOf(e.to)}`);

// stage: 0 not asked yet, 1 asked (go to `to`), 2 found (find: back to `from`), 3 done
// talking to walker n with these stages ({[errand id]: stage}) and `done` (ids already paid) ->
// { stages, say: [lines], pay: errand | null, took: errand | null, offer: errand | null }; null when n has nothing to do
// with today's errands. Q 부탁 받기 (docs/quest-accept-complete-20261026.md): a new ask is only offered (`offer`, the stages
// as they were) -- it starts with 「할게요!」 (accept); 「다음에요」 keeps nothing, so it is asked again
// `bag`: the goods I carry (a Set of item ids; a 'buy' errand takes its good -- `take`)
function talk(errands, stages, done, n, bag = new Set()) {
  const st = (e) => (done.has(e.id) ? 3 : stages[e.id] || 0);
  const set = (e, v) => ({ ...stages, [e.id]: v });
  const A = (e) => nameOf(e.from); const B = (e) => nameOf(e.to);
  // (T 주민 말투: every line in the speaking walker's own words; 묶음 1: where one is seen, in words, never a mark on the map)
  const vars = (e) => ({ thing: e.thing, who: B(e), from: A(e), where: e.where, why: Cast.whyOf(n, FIND_WHY.indexOf(e.why)) });
  const say = (e, key) => Cast.say(n, key, vars(e), () => 0);
  for (const e of errands) { // v1.10.92: the good bought for them
    if (e.kind !== 'buy' || e.from !== n || st(e) !== 1 || !bag.has(e.good)) continue;
    return { stages: set(e, 3), pay: e, took: null, take: e.good, say: say(e, 'got_buy') };
  }
  for (const e of errands) { // a thing brought, or someone found (the one I was sent to)
    if (e.to !== n || st(e) !== 1 || e.kind === 'buy') continue;
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
    if (st(e) === 1 && (e.kind !== 'buy' || bag.has(e.good))) out[e.to] = 'ready';
    if (e.kind === 'find' && st(e) === 2) out[e.from] = 'ready';
  }
  return out;
}
// the errands under way (the tracker line)
function track(errands, stages, done) {
  return errands.filter((e) => !done.has(e.id) && (stages[e.id] === 1 || stages[e.id] === 2))
    .map((e) => ({ id: e.id, title: title(e), label: label(e), to: stages[e.id] === 2 ? e.from : e.to, reward: e.reward }));
}

module.exports = { PER_DAY, REWARD, BUY_GOODS, errandsOf, talk, accept, drop, marks, track, title };
