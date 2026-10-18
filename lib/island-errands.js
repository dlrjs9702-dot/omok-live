'use strict';

// v1.10.91 주민 심부름 (사용자 2026-10-18): islanders ask for each other -- someone is looking for someone, or has a
// thing to be taken to someone. Three a day (Seoul), the same for everyone, each once per account and day. Pure: the
// server keeps where each account is in an errand (stage) and pays the end once (claimEvent). v1.10.92 잡화점: "buy me
// this at the store" (kind 'buy': the good from the bag to the asker, paid its price and a bonus).
const Cast = require('../public/plaza/island-cast');

const PER_DAY = 3;
const REWARD = { find: 2000, deliver: 1500, buy: 1500 }; // (buy: on top of the good's price)
const BUY_GOODS = ['bread', 'milk', 'bouquet', 'letter_paper', 'bulb', 'paint', 'guitar_string', 'nail_box'];
const GOOD_NAME = { bread: '빵 봉투', milk: '우유', bouquet: '꽃다발', letter_paper: '편지지', bulb: '전구', paint: '물감', guitar_string: '기타 줄', nail_box: '못 상자' };
const THINGS = ['편지', '도시락', '우산', '손수건', '쪽지', '빵 봉투', '꽃 한 송이', '열쇠'];
const FIND_WHY = ['빌려 간 책을 돌려받아야 하거든요', '꼭 할 말이 있는데 어디 갔는지 모르겠어요', '같이 산책하기로 했는데 안 보여요', '맛있는 걸 나눠 주고 싶은데 안 보이네요'];
const { josa } = Cast;
const nameOf = (n) => Cast.WALKERS[n].name;

const seeded = (text) => { let s = 2166136261; for (const ch of text) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
// the day's errands: different askers, someone else to find or bring to
function errandsOf(day) {
  const rnd = seeded(`errand:${day}`); const used = new Set(); const out = [];
  for (let k = 0; k < PER_DAY; k += 1) {
    let from; do from = Math.floor(rnd() * Cast.WALKERS.length); while (used.has(from));
    used.add(from);
    let to; do to = Math.floor(rnd() * Cast.WALKERS.length); while (to === from);
    const r = rnd(); const kind = r < 0.34 ? 'find' : r < 0.67 || out.some((e) => e.kind === 'buy') ? 'deliver' : 'buy'; // (one store errand a day at most)
    const good = kind === 'buy' ? BUY_GOODS[Math.floor(rnd() * BUY_GOODS.length)] : null;
    out.push(Object.freeze({ id: `errand_${day.replace(/-/g, '')}_${k}`, kind, from, to: kind === 'buy' ? from : to, reward: REWARD[kind], good,
      thing: kind === 'deliver' ? THINGS[Math.floor(rnd() * THINGS.length)] : good ? GOOD_NAME[good] : null, why: kind === 'find' ? FIND_WHY[Math.floor(rnd() * FIND_WHY.length)] : null }));
  }
  return out;
}
const title = (e) => (e.kind === 'find' ? `${nameOf(e.to)} 찾아 주기` : e.kind === 'buy' ? `${nameOf(e.from)}에게 ${e.thing} 사다 주기` : `${nameOf(e.to)}에게 ${e.thing} 전하기`);
const label = (e) => (e.kind === 'find' ? `${nameOf(e.to)} 찾기 → ${nameOf(e.from)}에게 알리기` : e.kind === 'buy' ? `잡화점 ${e.thing} → ${nameOf(e.from)}` : `${e.thing} → ${nameOf(e.to)}`);

// stage: 0 not asked yet, 1 asked (go to `to`), 2 found (find: back to `from`), 3 done
// talking to walker n with these stages ({[errand id]: stage}) and `done` (ids already paid) ->
// { stages, say: [lines], pay: errand | null, took: errand | null }; null when n has nothing to do with today's errands
// `bag`: the goods I carry (a Set of item ids; a 'buy' errand takes its good -- `take`)
function talk(errands, stages, done, n, bag = new Set()) {
  const st = (e) => (done.has(e.id) ? 3 : stages[e.id] || 0);
  const set = (e, v) => ({ ...stages, [e.id]: v });
  const A = (e) => nameOf(e.from); const B = (e) => nameOf(e.to);
  for (const e of errands) { // v1.10.92: the good bought for them
    if (e.kind !== 'buy' || e.from !== n || st(e) !== 1 || !bag.has(e.good)) continue;
    return { stages: set(e, 3), pay: e, took: null, take: e.good, say: [`${josa(e.thing, '이가')} 딱 필요했어요! 사다 줘서 고마워요.`, '물건값에 수고비까지 얹었어요.'] };
  }
  for (const e of errands) { // a thing brought, or someone found (the one I was sent to)
    if (e.to !== n || st(e) !== 1 || e.kind === 'buy') continue;
    if (e.kind === 'deliver') return { stages: set(e, 3), pay: e, took: null, say: [`${josa(A(e), '이가')} 보낸 ${e.thing}요? 와, 고마워요!`, '전해 준 사례예요. 받아 주세요.'] };
    return { stages: set(e, 2), pay: null, took: null, say: [`${josa(A(e), '이가')} 저를 찾는다고요? 아, 깜빡했어요!`, `알려 줘서 고마워요. ${A(e)}에게 곧 간다고 전해 줄래요?`] };
  }
  for (const e of errands) { // the asker, told
    if (e.from !== n || e.kind !== 'find' || st(e) !== 2) continue;
    return { stages: set(e, 3), pay: e, took: null, say: [`${josa(B(e), '을를')} 찾아 줬군요! 정말 고마워요.`, '이건 작은 사례예요.'] };
  }
  for (const e of errands) { // a new ask, or a reminder
    if (e.from !== n) continue;
    const s = st(e);
    if (s === 0) return { stages: set(e, 1), pay: null, took: e,
      say: e.kind === 'buy' ? [`오늘 ${josa(e.thing, '이가')} 필요한데 잡화점에 갈 틈이 없어요.`, `하나만 사다 줄래요? 물건값은 꼭 드릴게요!`] : e.kind === 'find' ? [`혹시 ${josa(B(e), '을를')} 못 봤어요? ${e.why}.`, `보면 제가 찾는다고 전해 주세요!`] : [`이 ${e.thing}, ${B(e)}에게 좀 전해 줄래요?`, '제가 지금 바빠서요. 부탁해요!'] };
    if (s === 1) return { stages, pay: null, took: null, say: [e.kind === 'buy' ? `${e.thing}, 잡화점에 있을 거예요. 부탁해요!` : e.kind === 'find' ? `${josa(B(e), '은는')} 아직 못 찾았어요? 섬 어딘가를 걷고 있을 거예요.` : `${e.thing}, ${B(e)}에게 아직 못 전했죠? 부탁해요!`] };
    if (s === 2) return null; // (handled above)
  }
  return null;
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

module.exports = { PER_DAY, REWARD, BUY_GOODS, errandsOf, talk, marks, track, title };
