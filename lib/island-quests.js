'use strict';

// v1.10.37 연계 퀘스트 1단계 (IDEAS 「게임 아일랜드 연계 퀘스트(주민 부탁 이야기)」, 사용자 확정 2026-10-06): an islander's
// request in a few steps, each made of what the island already has -- weeds pulled, trash picked up, a thing brought
// from the bag, a place visited. Talking to the islander takes a step on (and pays it when it is done); the next step
// is asked at once. Each story once a week (Monday 00:00 Asia/Seoul). Pure: the server feeds what happened and keeps the
// document (lib/point-store.js questApply); only what the server confirmed counts.
const T = require('../public/plaza/island-terrain');
const photoSteps = () => Object.freeze([
  Object.freeze({kind:'photo',need:3,reward:2000,ask:'사진 부탁을 받은 주민 세 명을 도와주세요.',label:'주민 사진 부탁'}),
  Object.freeze({kind:'visit',spot:Object.freeze({x:T.bridges[0].x,z:T.bridges[0].z}),r:4,reward:3000,ask:'개울 다리에서 섬의 풍경을 보고 와주세요.',label:'개울 다리 구경'}),
  Object.freeze({kind:'visit',spot:Object.freeze({x:T.SPOTS.chat.x,z:T.SPOTS.chat.z}),r:4,reward:2000,ask:'마지막으로 정자에 다녀와 주세요.',label:'정자 구경'}),
]);
const STORIES = Object.freeze({
  photographer: Object.freeze({name:'관광객 사진가',keeper:'photographer',at:Object.freeze({x:12,z:28}),bonus:15000,
    steps:photoSteps(),thanks:'섬의 풍경을 함께 찾아줘서 고마워요!'}),
  photomemory: Object.freeze({name:'첫 섬 나들이',keeper:'photographer',fixed:true,at:Object.freeze({x:12,z:28}),bonus:15000,
    steps:photoSteps(),memory:'memory_island',thanks:'함께한 나들이를 기념사진으로 남겼어요!'}),
  granny: Object.freeze({
    name: '정원사 할머니', at: Object.freeze({ x: 5.5, z: 39 }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'weed', need: 20, reward: 2000, ask: '잡초가 너무 많이 자랐구나. 잡초 20포기만 뽑아 주겠니?', label: '잡초' }),
      Object.freeze({ kind: 'give', item: 'berry', need: 5, reward: 3000, ask: '고맙구나! 나무 열매 5개를 가져다주면 잼을 만들어 볼게.', label: '나무 열매' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: 47, z: 38.3 }), r: 4, reward: 2000, ask: '강가에 꽃이 피었는지 보고 와 주렴.', label: '강가 꽃 구경' }),
    ]),
    thanks: '덕분에 정원이 환해졌구나. 정말 고마워!',
  }),
  fisher: Object.freeze({
    name: '항구 어부', at: Object.freeze({ x: 6.5, z: 69 }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'beach_trash', need: 5, reward: 2000, ask: '바닷가에 쓰레기가 많아요. 해안 쓰레기 5개를 주워 주시겠어요?', label: '해안 쓰레기' }),
      Object.freeze({ kind: 'give', item: 'mushroom', need: 3, reward: 3000, ask: '깨끗해졌네요! 미끼로 쓸 버섯 3개만 구해 주세요.', label: '버섯' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: 5, z: 92 }), r: 3.5, reward: 2000, ask: '이제 출항이에요. 부두 끝에서 배웅해 주세요!', label: '부두 끝 배웅' }),
    ]),
    thanks: '배웅 고마워요! 좋은 고기 많이 잡아 올게요.',
  }),
  // v1.10.39 섬 전체 할로윈 (IDEAS, 사용자 확정 2026-10-07): a costumed kid by the plaza, October only (Asia/Seoul)
  kid: Object.freeze({
    name: '할로윈 꼬마', at: Object.freeze({ x: -5, z: 19.5 }), bonus: 15000, month: 9,
    steps: Object.freeze([
      Object.freeze({ kind: 'give', item: 'candy', need: 3, reward: 3000, ask: '사탕 바구니를 채우고 싶어요! 섬에 떨어진 사탕 주머니 3개만 모아 주세요.', label: '사탕 주머니' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: 0, z: 5.5 }), r: 3.5, reward: 2000, ask: '와, 가득 찼다! 광장 큰 호박 앞에 먼저 가서 기다려 주세요.', label: '광장 큰 호박 앞' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: 5.5, z: 39 }), r: 4, reward: 2000, ask: '사탕을 정원사 할머니께도 나눠 드리고 싶어요. 할머니 댁 앞에 다녀와 주세요!', label: '할머니께 사탕 나눔' }),
    ]),
    thanks: '해피 할로윈! 같이 다녀 줘서 고마워요!',
  }),
});
const seoulMonth = (ms) => new Date(ms + 9 * 3600 * 1000).getUTCMonth();
// a story with `month` is out only in that month (Asia/Seoul; 9 = October)
const WEEK_MS = 7*86400000;
const ROTATION_START = Date.parse('2026-10-05T00:00:00+09:00'); // keep the already-open launch week intact
const WEEKLY = [['granny','fisher'],['fisher','photographer'],['photographer','granny']];
const weeklyStories = (now=Date.now()) => {
  const n=Math.floor((now-ROTATION_START)/WEEK_MS);
  return [...WEEKLY[((n%WEEKLY.length)+WEEKLY.length)%WEEKLY.length], ...(seoulMonth(now)===9?['kid']:[])];
};
const isOpen = (id, now = Date.now()) => Boolean(STORIES[id]) &&
  (STORIES[id].fixed || weeklyStories(now).includes(id));
const scopeOf = id => STORIES[id]?.fixed ? 'fixed' : 'week';
// One visible actor per keeper. The fixed introduction comes before that keeper's weekly follow-up.
function visibleStories(doc,now=Date.now()) {
  return Object.keys(STORIES).filter(id=>isOpen(id,now) &&
    (id!=='photographer' || doc?.photomemory?.done) &&
    (id!=='photomemory' || !doc?.photomemory?.done || !isOpen('photographer',now)));
}
const TALK_R = 3.2; // how close to an islander a talk counts

const fresh = () => ({ step: 0, taken: false, count: 0, done: false });
const storyState = (doc, id) => doc?.[id] || fresh();
const have = (bag, item) => (bag || []).filter((e) => e.itemId === item).reduce((n, e) => n + e.qty, 0);
// how far the current step is (a thing to bring counts what is in the bag now)
function progress(id, st, bag) {
  const step = STORIES[id].steps[st.step];
  if (!step) return null;
  const count = step.kind === 'give' ? Math.min(step.need, have(bag, step.item)) : st.count;
  const need = step.kind === 'visit' ? 1 : step.need;
  return { count, need, ready: count >= need };
}
// what the islander shows over their head: 'new' (yellow star), 'ready' (green check), or nothing while it is under way
function markOf(id, st, bag) {
  if (st.done) return null;
  if (!st.taken) return 'new';
  return progress(id, st, bag).ready ? 'ready' : null;
}
// the one-line tracker and where the step points on the map
function trackOf(id, st, bag) {
  if (st.done || !st.taken) return null;
  const story = STORIES[id]; const step = story.steps[st.step]; const p = progress(id, st, bag);
  return { story: id, name: story.name, label: step.label, count: p.count, need: p.need, ready: p.ready,
    to: p.ready ? story.at : step.kind === 'visit' ? step.spot : null };
}
// something happened on the island: a weed pulled, an event solved (its type), where the player stands
function note(doc, what, { qty = 1, x = null, z = null, now = Date.now(), scope = null } = {}) {
  let changed = false; const next = { ...(doc || {}) };
  for (const [id, story] of Object.entries(STORIES)) {
    if (scope && scopeOf(id)!==scope) continue;
    const st = storyState(doc, id); if (st.done || !st.taken || !isOpen(id, now)) continue;
    const step = story.steps[st.step];
    if (step.kind === 'visit') {
      if (what === 'at' && st.count < 1 && Math.hypot(x - step.spot.x, z - step.spot.z) <= step.r) { next[id] = { ...st, count: 1 }; changed = true; }
    } else if (step.kind === what && st.count < step.need) { next[id] = { ...st, count: Math.min(step.need, st.count + qty) }; changed = true; }
  }
  return changed ? next : null;
}
// talking to an islander standing near them: take the first step, or hand in a done one (its reward, the things it asked
// for out of the bag) and take the next -- the bonus with the last. -> { doc, reward, take, say } | { error }
function talk(doc, id, bag, pos, now = Date.now()) {
  const story = STORIES[id];
  if (!story || !isOpen(id, now)) return { error: 'NO_STORY' };
  if (!pos || Math.hypot(pos.x - story.at.x, pos.z - story.at.z) > TALK_R) return { error: 'TOO_FAR' };
  const st = storyState(doc, id);
  if (st.done) return { doc, reward: 0, take: null, say: story.thanks, step: null, done:true };
  if (!st.taken) return { doc: { ...doc, [id]: { ...st, taken: true, count: 0 } }, reward: 0, take: null, say: story.steps[st.step].ask, step: st.step };
  const step = story.steps[st.step]; const p = progress(id, st, bag);
  if (!p.ready) return { doc, reward: 0, take: null, say: step.ask, step: st.step, waiting: true };
  const last = st.step === story.steps.length - 1;
  const after = last ? { step: st.step + 1, taken: false, count: 0, done: true } : { step: st.step + 1, taken: true, count: 0, done: false };
  return { doc: { ...doc, [id]: after }, reward: step.reward + (last ? story.bonus : 0), take: step.kind === 'give' ? { itemId: step.item, qty: step.need } : null,
    memoryEntry: last ? story.memory || null : null,
    say: last ? story.thanks : story.steps[st.step + 1].ask, step: st.step, paid: true, done: last };
}

module.exports = { weeklyStories, visibleStories, scopeOf, STORIES, TALK_R, isOpen, markOf, trackOf, note, talk, progress };
