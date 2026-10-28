'use strict';

// v1.10.37 연계 퀘스트 1단계 (IDEAS 「게임 아일랜드 연계 퀘스트(주민 부탁 이야기)」, 사용자 확정 2026-10-06): an islander's
// request in a few steps, each made of what the island already has -- weeds pulled, trash picked up, a thing brought
// from the bag, a place visited. Talking to the islander takes a step on (and pays it when it is done); the next step
// is asked at once. Each story once a week (Monday 00:00 Asia/Seoul). Pure: the server feeds what happened and keeps the
// document (lib/point-store.js questApply); only what the server confirmed counts.
const T = require('../public/plaza/island-terrain');
// 달마루섬 (5단계): the givers' and the places' spots from dalmaru-terrain PLACES.quests -- 지금 섬's below
const S = T.dalmaru?.PLACES.quests || { photographer: { x: 12, z: 28 }, gardener: { x: 5.5, z: 39 }, flowers: { x: 47, z: 38.3 }, fisher: { x: 6.5, z: 69 }, pierEnd: { x: 5, z: 92 },
  station: { x: -83.1, z: 69.73 }, stonesBank: { x: 15, z: 18.6 }, kid: { x: -5, z: 19.5 }, pumpkin: { x: 0, z: 5.5 } };
const STATION = T.dalmaru ? '초승역' : '남서해안역'; const BRIDGE = T.dalmaru ? '윤슬다리' : '개울 다리';
// (문제 기록 3회차 17 「사진 찍기 퀘스트는 가서 말 걸면 끝나는 느낌」, 사용자 결정 10/22: 「곤충·물고기 부탁」) the photographer
// asks for an insect, then a fish, to photograph -- caught (the net swung, the arrows at the bite) and handed over. Ones the
// island has somewhere every day (its zones turn through the seasons): 메뚜기 at any hour, 붕어 in every river season.
const I = require('./island-insects'); const F = require('./island-fishing');
const catchSteps = (insect, insectAsk, fish, fishAsk) => Object.freeze([
  Object.freeze({ kind: 'give', item: `insect_${insect}`, need: 1, reward: 3000, ask: insectAsk, label: I.SPECIES[insect].name }),
  Object.freeze({ kind: 'give', item: `fish_${fish}`, need: 1, reward: 4000, ask: fishAsk, label: F.SPECIES[fish].name }),
]);
const STORIES = Object.freeze({
  photographer: Object.freeze({name:'빛나',keeper:'photographer',at:Object.freeze({...S.photographer}),bonus:15000,
    steps:catchSteps('ladybird','무당벌레를 가까이서 찍어 보고 싶어요. 꽃이나 풀에서 한 마리만 잡아다 주시겠어요? (잠자리채를 들고 휘둘러요)','goby','예쁘게 찍혔어요! 이번엔 바다의 망둥어요. 한 마리 낚아다 주세요.'),thanks:'섬의 생물 사진첩이 채워졌어요. 고마워요!'}),
  photomemory: Object.freeze({name:'첫 섬 나들이',keeper:'photographer',fixed:true,at:Object.freeze({...S.photographer}),bonus:15000,
    steps:catchSteps('grasshopper','섬의 생물을 사진에 담고 있어요. 풀밭의 메뚜기 한 마리만 잡아다 주시겠어요? (가방에서 잠자리채를 들고 휘둘러요)','crucian_carp','고마워요! 다음은 강의 붕어예요. 물가에서 한 마리 낚아다 주세요.'),memory:'memory_island',thanks:'함께한 나들이를 기념사진으로 남겼어요!'}),
  granny: Object.freeze({
    name: '꽃님', at: Object.freeze({ ...S.gardener }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'weed', need: 20, reward: 2000, ask: '잡초가 너무 많이 자랐구나. 잡초 20포기만 뽑아 주겠니?', label: '잡초' }),
      Object.freeze({ kind: 'give', item: 'berry', need: 5, reward: 3000, ask: '고맙구나! 나무 열매 5개를 가져다주면 잼을 만들어 볼게.', label: '나무 열매' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.flowers }), r: 4, reward: 2000, ask: '강가에 꽃이 피었는지 보고 와 주렴.', label: '강가 꽃 구경' }),
    ]),
    thanks: '덕분에 정원이 환해졌구나. 정말 고마워!',
  }),
  fisher: Object.freeze({
    name: '물결', at: Object.freeze({ ...S.fisher }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'beach_trash', need: 5, reward: 2000, ask: '바닷가에 쓰레기가 많아요. 해안 쓰레기 5개를 주워 주시겠어요?', label: '해안 쓰레기' }),
      Object.freeze({ kind: 'give', item: 'mushroom', need: 3, reward: 3000, ask: '깨끗해졌네요! 미끼로 쓸 버섯 3개만 구해 주세요.', label: '버섯' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.pierEnd }), r: 3.5, reward: 2000, ask: '이제 출항이에요. 부두 끝에서 배웅해 주세요!', label: '부두 끝 배웅' }),
    ]),
    thanks: '배웅 고마워요! 좋은 고기 많이 잡아 올게요.',
  }),
  // v1.10.80 농부 × 두더지 잡기 (IDEAS #future-island-minigames): the first story with a game in it -- the step is done by a
  // round of 두더지 잡기 the server paid (lib/reflex.js judge 'ok') at or over `need` points, any level. Every week; who
  // helped this week (the game step done) also grows the shared field (server islandFarm).
  farmer: Object.freeze({
    name: '한들', at: Object.freeze({ x: T.FARM.farmer.x, z: T.FARM.farmer.z }), bonus: 15000, always: true,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'whack', level: 'easy', need: 200, reward: 3000, ask: '두더지가 밭을 망치고 있어요~ 잡아 주세요! (두더지 잡기 200점 이상)', label: '두더지 잡기 200점' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.FARM.x, z: T.FARM.z }), r: 4.5, reward: 4000, ask: '덕분에 살았어요! 밭이 어떻게 됐는지 한 바퀴 둘러봐 주세요.', label: '밭 둘러보기' }),
    ]),
    thanks: '이번 주 밭은 걱정 없겠어요. 정말 고마워요!',
  }),
  // v1.10.93 마을 주민 미니게임 퀘스트 2단계 (IDEAS #future-island-minigames, assets 39): the farmer's frame for three more --
  // a round of an existing game at the goal, then a look at what it changed; every week, and each week's helpers together
  // change the island for everyone (the mural fills in, the stage plays). `lower`: a time, the lower the better.
  painter: Object.freeze({
    name: '고은', at: Object.freeze({ x: T.VILLAGE.painter.x, z: T.VILLAGE.painter.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'colorfind', level: 'easy', need: 12, reward: 3000, ask: '벽화 물감 색이 헷갈려요. 다른 색을 찾아 주세요! (다른 색 찾기 12점 이상)', label: '다른 색 찾기 12점' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.VILLAGE.mural.x, z: T.VILLAGE.mural.z }), r: 4, reward: 4000, ask: '덕분에 색이 맞았어요! 벽화가 얼마나 그려졌는지 가까이서 봐 주세요.', label: '벽화 구경' }),
    ]),
    thanks: '이번 주 벽화는 섬 사람들이 같이 그린 거예요. 고마워요!',
  }),
  stationmaster: Object.freeze({
    name: '철이', at: Object.freeze({ x: T.VILLAGE.stationmaster.x, z: T.VILLAGE.stationmaster.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'numbers', level: 'easy', need: 40000, lower: true, reward: 3000, ask: '열차 시간표 번호가 뒤죽박죽이에요. 순서대로 정리해 주세요! (숫자 터치 40초 안에)', label: '숫자 터치 40초' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.station }), r: 5, reward: 4000, ask: `시간표가 맞았어요! ${STATION}에도 잘 붙었는지 다녀와 주세요. 열차를 타면 금방이에요.`, label: `${STATION} 다녀오기` }),
    ]),
    thanks: '열차가 시간표대로 다녀요. 정말 고마워요!',
  }),
  busker: Object.freeze({
    name: '가락', at: Object.freeze({ x: T.VILLAGE.busker.x, z: T.VILLAGE.busker.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'rhythm', level: 'easy', need: 6000, reward: 3000, ask: '오늘 공연 박자를 맞춰 볼래요? (비트 탭 6,000점 이상)', label: '비트 탭 6,000점' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.VILLAGE.busk.x, z: T.VILLAGE.busk.z }), r: 4.5, reward: 4000, ask: '박자가 딱 맞았어요! 무대 앞에서 공연을 들어 주세요.', label: '무대 앞에서 공연 듣기' }),
    ]),
    thanks: '관객이 있으니 신나게 연주했어요. 고마워요!',
  }),
  // A2b: three more with the puzzles (오늘의 문제 쉬움 -- the same for everyone that day; `puzzle`: solved today already counts)
  electrician: Object.freeze({
    name: '반디', at: Object.freeze({ x: T.VILLAGE.electrician.x, z: T.VILLAGE.electrician.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'circuit', level: 'easy', need: 1, puzzle: true, reward: 3000, ask: '관공서 가는 길 가로등이 꺼졌어요. 회로를 이어 주실래요? (오늘의 회로 연결 쉬움)', label: '오늘의 회로 연결 쉬움' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.VILLAGE.lamps[1].x, z: T.VILLAGE.lamps[1].z }), r: 4, reward: 4000, ask: '불이 들어왔어요! 길가 가로등이 잘 켜졌는지 봐 주세요.', label: '가로등 둘러보기' }),
    ]),
    thanks: '이번 주 가로등은 섬 사람들이 같이 고친 거예요. 고마워요!',
  }),
  builder: Object.freeze({
    name: '바위', at: Object.freeze({ x: T.VILLAGE.builder.x, z: T.VILLAGE.builder.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'hashi', level: 'easy', need: 1, puzzle: true, reward: 3000, ask: '개울에 징검돌을 놓으려는데 어디에 놓을지 헷갈려요. 다리 잇기로 길을 찾아 주세요! (오늘의 다리 잇기 쉬움)', label: '오늘의 다리 잇기 쉬움' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.stonesBank }), r: 4.5 /* (the bank by the stones) */, reward: 4000, ask: '길이 보여요! 개울 징검돌이 잘 놓였는지 봐 주세요.', label: '징검돌 보러 가기' }),
    ]),
    thanks: '징검돌이 하나씩 늘어 가요. 다들 고마워요!',
  }),
  librarian: Object.freeze({
    name: '한결', at: Object.freeze({ x: T.VILLAGE.librarian.x, z: T.VILLAGE.librarian.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'nonogram', level: 'easy', need: 1, puzzle: true, reward: 3000, ask: '책 표지 그림이 지워졌구나. 네모로직으로 그림을 되찾아 주겠니? (오늘의 네모로직 쉬움)', label: '오늘의 네모로직 쉬움' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.VILLAGE.bookcart.x, z: T.VILLAGE.bookcart.z }), r: 3.5, reward: 4000, ask: '그림이 돌아왔구나! 책 수레에 새 책이 꽂혔는지 봐 주렴.', label: '책 수레 보기' }),
    ]),
    thanks: '책 수레가 가득 찼구나. 고맙다!',
  }),
  // A2c 정자 할아버지 × AI 대전: a game room against the server's AI (game `ai_<room game>`, lib/room-ai.js) -- the
  // server plays the AI and decides the winner, a win at any level counts (qty: 1 쉬움 · 2 보통 · 3 어려움)
  grandpa: Object.freeze({
    name: '느티', at: Object.freeze({ x: T.VILLAGE.grandpa.x, z: T.VILLAGE.grandpa.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'ai_omok', level: 'easy', need: 1, ai: true, reward: 3000, ask: '오목 한 판 두겠나? 내 제자 AI를 이기면 인정해 주지. (AI 오목 이기기)', label: 'AI 오목 이기기' }),
      Object.freeze({ kind: 'minigame', game: 'ai_othello', level: 'easy', need: 1, ai: true, reward: 4000, ask: '제법이구먼! 이번엔 오델로다. 판을 뒤집어 보게. (AI 오델로 이기기)', label: 'AI 오델로 이기기' }),
    ]),
    thanks: '허허, 오랜만에 손맛 좋은 대국이었네. 또 오게!',
  }),
  // v1.10.39 섬 전체 할로윈 (IDEAS, 사용자 확정 2026-10-07): a costumed kid by the plaza, October only (Asia/Seoul)
  kid: Object.freeze({
    name: '콩이', at: Object.freeze({ ...S.kid }), bonus: 15000, month: 9,
    steps: Object.freeze([
      Object.freeze({ kind: 'give', item: 'candy', need: 3, reward: 3000, ask: '사탕 바구니를 채우고 싶어요! 섬에 떨어진 사탕 주머니 3개만 모아 주세요.', label: '사탕 주머니' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.pumpkin }), r: 3.5, reward: 2000, ask: '와, 가득 찼다! 광장 큰 호박 앞에 먼저 가서 기다려 주세요.', label: '광장 큰 호박 앞' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.gardener }), r: 4, reward: 2000, ask: '사탕을 정원사 할머니께도 나눠 드리고 싶어요. 할머니 댁 앞에 다녀와 주세요!', label: '할머니께 사탕 나눔' }),
    ]),
    thanks: '해피 할로윈! 같이 다녀 줘서 고마워요!',
  }),
});
const seoulMonth = (ms) => new Date(ms + 9 * 3600 * 1000).getUTCMonth();
// a story with `month` is out only in that month (Asia/Seoul; 9 = October)
const WEEK_MS = 7*86400000;
const ROTATION_START = Date.parse('2026-10-05T00:00:00+09:00'); // keep the already-open launch week intact
const WEEKLY = [['granny','fisher'],['fisher','photographer'],['photographer','granny']];
// v1.10.93: one of the village's residents each week (their project that week: the mural, the lamps, the stage, the stepping
// stones, the timetable, the book cart) -- one a week keeps the weekly total as planned
const VILLAGE = ['painter', 'electrician', 'busker', 'builder', 'stationmaster', 'librarian', 'grandpa']; // (A2c: the grandpa's matches)
// ISLAND_QUEST_WEEK (tests only): the rotation held at one week, so a test of a story does not depend on today's week
const weeklyStories = (now=Date.now()) => {
  const fixed=process.env.ISLAND_QUEST_WEEK;
  const n=fixed!=null&&fixed!==''?Number(fixed):Math.floor((now-ROTATION_START)/WEEK_MS);
  return [...WEEKLY[((n%WEEKLY.length)+WEEKLY.length)%WEEKLY.length], ...(seoulMonth(now)===9?['kid']:[]), ...Object.keys(STORIES).filter((id) => STORIES[id].always), VILLAGE[((n%VILLAGE.length)+VILLAGE.length)%VILLAGE.length]];
};
const isOpen = (id, now = Date.now()) => Boolean(STORIES[id]) &&
  (STORIES[id].fixed || weeklyStories(now).includes(id));
const scopeOf = id => STORIES[id]?.fixed ? 'fixed' : 'week';
// One visible actor per keeper. The fixed introduction comes before that keeper's weekly follow-up.
function visibleStories(doc,now=Date.now()) {
  return Object.keys(STORIES).filter(id=>isOpen(id,now) &&
    (id!=='photographer' || storyState(doc,'photomemory').done) &&
    (id!=='photomemory' || !storyState(doc,'photomemory').done || !isOpen('photographer',now)));
}
const TALK_R = 3.2; // how close to an islander a talk counts

const fresh = () => ({ step: 0, taken: false, count: 0, done: false, v: 2 });
// (3회차 17) the photo requests' old steps are gone: one under way from before them (no `v`) counts as done -- what it paid
// stays paid
const REWORKED = new Set(['photographer', 'photomemory']);
const storyState = (doc, id) => { const st = doc?.[id]; return st && REWORKED.has(id) && st.taken && !st.done && st.v !== 2 ? { ...st, done: true } : st || fresh(); };
const have = (bag, item) => (bag || []).filter((e) => e.itemId === item).reduce((n, e) => n + e.qty, 0);
// how far the current step is (a thing to bring counts what is in the bag now)
function progress(id, st, bag) {
  const step = STORIES[id].steps[st.step];
  if (!step) return null;
  const count = step.kind === 'give' ? Math.min(step.need, have(bag, step.item)) : st.count;
  const need = step.kind === 'visit' || step.kind === 'minigame' ? 1 : step.need;
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
    if (step.kind === 'minigame') { // what: `minigame:<game>`, qty: the round's score
      if (what === `minigame:${step.game}` && st.count < 1 && (step.lower ? qty <= step.need : qty >= step.need)) { next[id] = { ...st, count: 1 }; changed = true; }
    } else if (step.kind === 'visit') {
      if (what === 'at' && st.count < 1 && Math.hypot(x - step.spot.x, z - step.spot.z) <= step.r) { next[id] = { ...st, count: 1 }; changed = true; }
    } else if (step.kind === what && st.count < step.need) { next[id] = { ...st, count: Math.min(step.need, st.count + qty) }; changed = true; }
  }
  return changed ? next : null;
}
// talking to an islander standing near them: take the first step, or hand in a done one (its reward, the things it asked
// for out of the bag) and take the next -- the bonus with the last. -> { doc, reward, take, say } | { error }
// Q 부탁 받기 (docs/quest-accept-complete-20261026.md): a story not under way is only offered (`offer`) until `accept`
// (「할게요!」); the steps after the first follow on as before
function talk(doc, id, bag, pos, now = Date.now(), accept = false) {
  const story = STORIES[id];
  if (!story || !isOpen(id, now)) return { error: 'NO_STORY' };
  if (!pos || Math.hypot(pos.x - story.at.x, pos.z - story.at.z) > TALK_R) return { error: 'TOO_FAR' };
  const st = storyState(doc, id);
  if (st.done) return { doc, reward: 0, take: null, say: story.thanks, step: null, done:true };
  if (!st.taken && !accept) return { doc, reward: 0, take: null, say: story.steps[st.step].ask, step: st.step, offer: true };
  if (!st.taken) return { doc: { ...doc, [id]: { ...st, taken: true, count: 0, v: 2 } }, reward: 0, take: null, say: story.steps[st.step].ask, step: st.step, accepted: true };
  const step = story.steps[st.step]; const p = progress(id, st, bag);
  if (!p.ready) return { doc, reward: 0, take: null, say: step.ask, step: st.step, waiting: true };
  const last = st.step === story.steps.length - 1;
  const after = last ? { step: st.step + 1, taken: false, count: 0, done: true, v: 2 } : { step: st.step + 1, taken: true, count: 0, done: false, v: 2 };
  return { doc: { ...doc, [id]: after }, reward: step.reward + (last ? story.bonus : 0), take: step.kind === 'give' ? { itemId: step.item, qty: step.need } : null,
    memoryEntry: last ? story.memory || null : null,
    say: last ? story.thanks : story.steps[st.step + 1].ask, step: st.step, paid: true, done: last };
}

// (Q 「그만둘래요」) a story under way let go: back to waiting to be asked at the step it was on (what was paid stays paid)
function drop(doc, id) {
  const st = storyState(doc, id);
  if (!STORIES[id] || st.done || !st.taken) return null;
  return { ...doc, [id]: { ...st, taken: false, count: 0, v: 2 } };
}

module.exports = { weeklyStories, visibleStories, scopeOf, STORIES, TALK_R, isOpen, storyState, markOf, trackOf, note, talk, drop, progress };
