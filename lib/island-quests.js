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
// 206 구경 C안 (사용자 「c 안으로 가자」, gamecenter-notes docs/interact-quests-20261029.md 2-1): a visit is done by a small task
// there, not by walking in. A pick (the colour, the fallen one, the book): the server draws it when the step is taken and keeps
// it in the doc, the screen's choice checked against it. A timing (the boat, the beat, the lamp): the screen judges it, the
// server only the time from its start and the place. Nothing by sound; no new models.
const V = T.VILLAGE || {}; const PIER = S.pierEnd;
const at = (p, dx = 0, dz = 0) => Object.freeze({ x: Math.round((p.x + dx) * 100) / 100, z: Math.round((p.z + dz) * 100) / 100 });
const before = (p, d, side) => at(p, Math.sin(p.yaw) * d + Math.cos(p.yaw) * side, Math.cos(p.yaw) * d - Math.sin(p.yaw) * side); // (side + : its right as seen facing it)
const STONES_FAR = at({ x: 2 * V.stones.x - S.stonesBank.x, z: 2 * V.stones.z - S.stonesBank.z }); // (the bank across, the crossing's mirror)
const COLORS = Object.freeze({ red: '빨간', yellow: '노란', white: '하얀', pink: '분홍', purple: '보라' });
const BOOKS = Object.freeze(['바다 생물 도감', '별자리 이야기', '섬 요리책', '나무 이름 사전', '등대지기의 노래']);
const TASK = Object.freeze({
  flowers: Object.freeze({ type: 'pick', pool: Object.keys(COLORS), spots: Object.freeze([at(S.flowers, 0, 2), at(S.flowers, 2.5, 0), at(S.flowers, 0, -2)]), r: 2.5, say: '향긋해요. 꽃님께 전해야지.' }),
  pier: Object.freeze({ type: 'timed', at: at(PIER), r: 4, minMs: 5000, say: '잘 다녀오세요!' }),
  scarecrow: Object.freeze({ type: 'pick', show: true /* (the fallen one is seen -- to find, not to guess) */, spots: Object.freeze([at(T.FARM, -3, -2.5), at(T.FARM, 3, -2.5)]), r: 2.5, say: '다시 반듯하게 섰어요. 밭이 멀쩡해요.' }),
  mural: Object.freeze({ type: 'order', spots: Object.freeze([before(V.mural, 2.2, -1.6), before(V.mural, 2.2, 0), before(V.mural, 2.2, 1.6)]), r: 2, say: '색이 딱 맞네요.' }),
  station: Object.freeze({ type: 'train', at: at(S.station), r: 5, stop: 'W', say: '시간표가 잘 붙었어요.' }),
  busk: Object.freeze({ type: 'timed', at: before(V.busk, 2.5, 0), r: 4.5, minMs: 3000, say: '앵콜!' }),
  lamp: Object.freeze({ type: 'timed', at: at(V.lamps?.[1] || S.pumpkin), r: 4, minMs: 2000, say: '반짝! 불이 환하게 들어왔어요.' }),
  stones: Object.freeze({ type: 'cross', from: at(S.stonesBank), to: STONES_FAR, r: 2.5, minMs: 1500, say: '단단해요. 잘 놓였어요.' }),
  books: Object.freeze({ type: 'pick', pool: BOOKS, at: at(V.bookcart || S.photographer), r: 3, say: '새 책이 꽂혔어요.' }),
  pumpkin: Object.freeze({ type: 'knock', at: at(S.pumpkin), r: 3, times: 3, gapMs: 400, say: '통통 소리가 나요.' }),
  candy: Object.freeze({ type: 'candy', basket: at(S.gardener, 1.2, 0), door: at(S.gardener, -1.2, 0), r: 2.5, say: '할머니 몫 두고 가요.' }),
});
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
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.flowers }), r: 4, reward: 2000, ask: '강가에 {pick} 꽃이 피었다던데, 찾아서 냄새 좀 맡아 보고 와 주렴.', label: '강가 {pick} 꽃 냄새 맡기', task: TASK.flowers }),
    ]),
    thanks: '덕분에 정원이 환해졌구나. 정말 고마워!',
  }),
  fisher: Object.freeze({
    name: '물결', at: Object.freeze({ ...S.fisher }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'beach_trash', need: 5, reward: 2000, ask: '바닷가에 쓰레기가 많아요. 해안 쓰레기 5개를 주워 주시겠어요?', label: '해안 쓰레기' }),
      Object.freeze({ kind: 'give', item: 'mushroom', need: 3, reward: 3000, ask: '깨끗해졌네요! 미끼로 쓸 버섯 3개만 구해 주세요.', label: '버섯' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.pierEnd }), r: 3.5, reward: 2000, ask: '이제 출항이에요. 부두 끝에서 배가 멀어질 때까지 손 흔들어 배웅해 주세요!', label: '부두 끝 배웅하기', task: TASK.pier }),
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
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.FARM.x, z: T.FARM.z }), r: 4.5, reward: 4000, ask: '덕분에 살았어요! 그런데 밭 허수아비 하나가 넘어졌대요. 찾아서 세워 주세요.', label: '넘어진 허수아비 세우기', task: TASK.scarecrow }),
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
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.VILLAGE.mural.x, z: T.VILLAGE.mural.z }), r: 4, reward: 4000, ask: '덕분에 색이 맞았어요! 벽화 앞 반짝이는 곳 셋을 왼쪽부터 차례로 가까이 봐 주세요.', label: '벽화 반짝이 차례로 보기', task: TASK.mural }),
    ]),
    thanks: '이번 주 벽화는 섬 사람들이 같이 그린 거예요. 고마워요!',
  }),
  stationmaster: Object.freeze({
    name: '철이', at: Object.freeze({ x: T.VILLAGE.stationmaster.x, z: T.VILLAGE.stationmaster.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'numbers', level: 'easy', need: 40000, lower: true, reward: 3000, ask: '열차 시간표 번호가 뒤죽박죽이에요. 순서대로 정리해 주세요! (숫자 터치 40초 안에)', label: '숫자 터치 40초' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.station }), r: 5, reward: 4000, ask: `시간표가 맞았어요! ${STATION} 이름판에서 다음 열차가 몇 분 뒤에 오는지 세어 봐 주세요. 열차를 타면 금방이에요.`, label: `${STATION} 다음 열차 시간 세기`, task: TASK.station }),
    ]),
    thanks: '열차가 시간표대로 다녀요. 정말 고마워요!',
  }),
  busker: Object.freeze({
    name: '가락', at: Object.freeze({ x: T.VILLAGE.busker.x, z: T.VILLAGE.busker.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'rhythm', level: 'easy', need: 6000, reward: 3000, ask: '오늘 공연 박자를 맞춰 볼래요? (비트 탭 6,000점 이상)', label: '비트 탭 6,000점' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.VILLAGE.busk.x, z: T.VILLAGE.busk.z }), r: 4.5, reward: 4000, ask: '박자가 딱 맞았어요! 무대 앞에서 빛나는 고리에 맞춰 세 번 박수 쳐 주세요.', label: '박자 맞춰 박수 치기', task: TASK.busk }),
    ]),
    thanks: '관객이 있으니 신나게 연주했어요. 고마워요!',
  }),
  // A2b: three more with the puzzles (오늘의 문제 쉬움 -- the same for everyone that day; `puzzle`: solved today already counts)
  electrician: Object.freeze({
    name: '반디', at: Object.freeze({ x: T.VILLAGE.electrician.x, z: T.VILLAGE.electrician.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'circuit', level: 'easy', need: 1, puzzle: true, reward: 3000, ask: '관공서 가는 길 가로등이 꺼졌어요. 회로를 이어 주실래요? (오늘의 회로 연결 쉬움)', label: '오늘의 회로 연결 쉬움' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.VILLAGE.lamps[1].x, z: T.VILLAGE.lamps[1].z }), r: 4, reward: 4000, ask: '불이 들어왔어요! 길가 가로등이 깜빡이다 환해지는 순간을 잡아 주세요.', label: '가로등 환해질 때 잡기', task: TASK.lamp }),
    ]),
    thanks: '이번 주 가로등은 섬 사람들이 같이 고친 거예요. 고마워요!',
  }),
  builder: Object.freeze({
    name: '바위', at: Object.freeze({ x: T.VILLAGE.builder.x, z: T.VILLAGE.builder.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'hashi', level: 'easy', need: 1, puzzle: true, reward: 3000, ask: '개울에 징검돌을 놓으려는데 어디에 놓을지 헷갈려요. 다리 잇기로 길을 찾아 주세요! (오늘의 다리 잇기 쉬움)', label: '오늘의 다리 잇기 쉬움' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.stonesBank }), r: 4.5 /* (the bank by the stones) */, reward: 4000, ask: '길이 보여요! 첫 징검돌에서 시작해 맞은편 둑까지 건너 봐 주세요.', label: '징검돌 건너기', task: TASK.stones }),
    ]),
    thanks: '징검돌이 하나씩 늘어 가요. 다들 고마워요!',
  }),
  librarian: Object.freeze({
    name: '한결', at: Object.freeze({ x: T.VILLAGE.librarian.x, z: T.VILLAGE.librarian.z }), bonus: 15000,
    steps: Object.freeze([
      Object.freeze({ kind: 'minigame', game: 'nonogram', level: 'easy', need: 1, puzzle: true, reward: 3000, ask: '책 표지 그림이 지워졌구나. 네모로직으로 그림을 되찾아 주겠니? (오늘의 네모로직 쉬움)', label: '오늘의 네모로직 쉬움' }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ x: T.VILLAGE.bookcart.x, z: T.VILLAGE.bookcart.z }), r: 3.5, reward: 4000, ask: '그림이 돌아왔구나! 책 수레에 「{pick}」이 꽂혔는지 찾아봐 주렴.', label: '책 수레에서 「{pick}」 찾기', task: TASK.books }),
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
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.pumpkin }), r: 3.5, reward: 2000, ask: '와, 가득 찼다! 광장 큰 호박을 세 번 톡톡 두드려 봐요.', label: '큰 호박 세 번 두드리기', task: TASK.pumpkin }),
      Object.freeze({ kind: 'visit', spot: Object.freeze({ ...S.gardener }), r: 4, reward: 2000, ask: '사탕을 정원사 할머니께도 나눠 드리고 싶어요. 할머니 댁 바구니에 사탕 하나 넣고 문을 두드려 주세요!', label: '바구니에 사탕 넣고 문 두드리기', task: TASK.candy }),
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
// a visit's pick drawn as the step is taken -> { options, answer } (the screen gets the options, never the answer)
function drawPick(step, rnd = Math.random) {
  const t = step?.task; if (!t || t.type !== 'pick') return null;
  const n = t.spots ? t.spots.length : 3; const pool = t.pool ? [...t.pool] : null;
  if (pool) for (let i = pool.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)) % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return { options: pool ? pool.slice(0, n) : null, answer: Math.floor(rnd() * n) % n };
}
const pickName = (step, pick) => (pick?.options ? (step.task === TASK.flowers ? COLORS[pick.options[pick.answer]] : pick.options[pick.answer]) : '');
const askOf = (step, st) => String(step?.ask || '').replace('{pick}', pickName(step, st?.pick));
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
  const task = step.task && !p.ready ? { ...step.task, id: Object.keys(TASK).find((k) => TASK[k] === step.task), say: undefined, options: st.pick?.options || null, run: st.run || null, ...(step.task.show ? { shown: st.pick?.answer ?? 0 } : {}) } : null;
  return { story: id, name: story.name, label: String(step.label).replace('{pick}', pickName(step, st.pick) || '').replace('  ', ' ').replace('「」 ', ''), /* (206: the colour, the book asked -- on the card too) */ count: p.count, need: p.need, ready: p.ready,
    to: p.ready ? story.at : step.kind === 'visit' ? step.spot : null, ...(task ? { task } : {}) };
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
      if (!step.task && what === 'at' && st.count < 1 && Math.hypot(x - step.spot.x, z - step.spot.z) <= step.r) { next[id] = { ...st, count: 1 }; changed = true; } // (206: a task's visit by its task)
    } else if (step.kind === what && st.count < step.need) { next[id] = { ...st, count: Math.min(step.need, st.count + qty) }; changed = true; }
  }
  return changed ? next : null;
}
// talking to an islander standing near them: take the first step, or hand in a done one (its reward, the things it asked
// for out of the bag) and take the next -- the bonus with the last. -> { doc, reward, take, say } | { error }
// Q 부탁 받기 (docs/quest-accept-complete-20261026.md): a story not under way is only offered (`offer`) until `accept`
// (「할게요!」); the steps after the first follow on as before
function talk(doc, id, bag, pos, now = Date.now(), accept = false, rnd = Math.random) {
  const story = STORIES[id];
  if (!story || !isOpen(id, now)) return { error: 'NO_STORY' };
  if (!pos || Math.hypot(pos.x - story.at.x, pos.z - story.at.z) > TALK_R) return { error: 'TOO_FAR' };
  const st = storyState(doc, id);
  if (st.done) return { doc, reward: 0, take: null, say: story.thanks, step: null, done:true };
  if (!st.taken && !accept) { const pick = st.pick || drawPick(story.steps[st.step], rnd); return { doc: pick && !st.pick ? { ...doc, [id]: { ...st, pick } } : doc, reward: 0, take: null, say: askOf(story.steps[st.step], { pick }), step: st.step, offer: true }; }
  if (!st.taken) { const pick = st.pick || drawPick(story.steps[st.step], rnd); return { doc: { ...doc, [id]: { ...st, taken: true, count: 0, v: 2, ...(pick ? { pick } : {}) } }, reward: 0, take: null, say: askOf(story.steps[st.step], { pick }), step: st.step, accepted: true }; }
  const step = story.steps[st.step]; const p = progress(id, st, bag);
  if (!p.ready) return { doc, reward: 0, take: null, say: askOf(step, st), step: st.step, waiting: true };
  const last = st.step === story.steps.length - 1;
  const nextPick = last ? null : drawPick(story.steps[st.step + 1], rnd);
  const after = last ? { step: st.step + 1, taken: false, count: 0, done: true, v: 2 } : { step: st.step + 1, taken: true, count: 0, done: false, v: 2, ...(nextPick ? { pick: nextPick } : {}) };
  return { doc: { ...doc, [id]: after }, reward: step.reward + (last ? story.bonus : 0), take: step.kind === 'give' ? { itemId: step.item, qty: step.need } : null,
    memoryEntry: last ? story.memory || null : null,
    say: last ? story.thanks : askOf(story.steps[st.step + 1], { pick: nextPick }), step: st.step, paid: true, done: last };
}

// 206: a visit's task, one act at a time, where I stand -- 'choose' (a pick, the train's minutes), 'start'/'finish' (a timing,
// the crossing), 'tap' (the mural in order, the pumpkin's knocks), 'basket'/'door' (the candy). trainIn(stop, now): minutes
// to the next train there (the server's own timetable)
function visitAct(doc, id, act, input, pos, now = Date.now(), bag = [], { trainIn = () => null } = {}) {
  const story = STORIES[id]; if (!story || !isOpen(id, now)) return { error: 'NO_STORY' };
  const st = storyState(doc, id); const step = story.steps[st.step]; const t = step?.task;
  if (st.done || !st.taken || step?.kind !== 'visit' || !t) return { error: 'NO_TASK' };
  if (st.count >= 1) return { error: 'VISIT_DONE' };
  const near = (p, r = t.r) => Boolean(pos) && Math.hypot(pos.x - p.x, pos.z - p.z) <= r;
  const done = () => ({ doc: { ...doc, [id]: { ...st, count: 1, run: null } }, done: true, say: t.say });
  const run = (r) => ({ doc: { ...doc, [id]: { ...st, run: r } }, done: false });
  const choice = Number(input?.choice);
  if (t.type === 'pick') {
    if (act !== 'choose' || !Number.isInteger(choice) || choice < 0 || choice >= (t.spots ? t.spots.length : 3)) return { error: 'BAD_VISIT' };
    if (!near(t.spots ? t.spots[choice] : t.at)) return { error: 'TOO_FAR' };
    return choice === st.pick?.answer ? done() : { error: 'VISIT_WRONG' };
  }
  if (t.type === 'train') {
    if (act !== 'choose' || !Number.isFinite(choice)) return { error: 'BAD_VISIT' }; if (!near(t.at)) return { error: 'TOO_FAR' };
    const m = trainIn(t.stop, now); return m != null && Math.abs(choice - m) <= 1 ? done() : { error: 'VISIT_WRONG' };
  }
  if (t.type === 'timed' || t.type === 'cross') {
    const from = t.type === 'cross' ? t.from : t.at; const to = t.type === 'cross' ? t.to : t.at;
    if (act === 'start') return near(from) ? run({ at: now }) : { error: 'TOO_FAR' };
    if (act !== 'finish') return { error: 'BAD_VISIT' };
    if (!Number.isFinite(st.run?.at)) return { error: 'VISIT_NOT_STARTED' };
    if (!near(to)) return { error: 'TOO_FAR' };
    return now - st.run.at >= t.minMs ? done() : { error: 'VISIT_TOO_SOON' };
  }
  if (t.type === 'order') {
    const k = st.run?.k || 0; if (act !== 'tap' || choice !== k) return k && act === 'tap' ? { ...run({ k: 0 }), error: 'VISIT_WRONG' } : { error: 'VISIT_WRONG' };
    if (!near(t.spots[k])) return { error: 'TOO_FAR' };
    return k + 1 >= t.spots.length ? done() : run({ k: k + 1 });
  }
  if (t.type === 'knock') {
    if (act !== 'tap') return { error: 'BAD_VISIT' }; if (!near(t.at)) return { error: 'TOO_FAR' };
    const k = st.run?.k || 0; if (k && now - st.run.at < t.gapMs) return { error: 'VISIT_TOO_SOON' };
    return k + 1 >= t.times ? done() : run({ k: k + 1, at: now });
  }
  if (t.type === 'candy') {
    if (act === 'basket') { if (st.run?.basket) return { error: 'VISIT_DONE_PART' }; if (!near(t.basket)) return { error: 'TOO_FAR' }; if (!have(bag, 'candy')) return { error: 'NO_CANDY' }; return { ...run({ basket: true }), take: { itemId: 'candy', qty: 1 } }; }
    if (act !== 'door') return { error: 'BAD_VISIT' }; if (!st.run?.basket) return { error: 'VISIT_NOT_STARTED' };
    return near(t.door) ? done() : { error: 'TOO_FAR' };
  }
  return { error: 'BAD_VISIT' };
}

// (Q 「그만둘래요」) a story under way let go: back to waiting to be asked at the step it was on (what was paid stays paid)
function drop(doc, id) {
  const st = storyState(doc, id);
  if (!STORIES[id] || st.done || !st.taken) return null;
  return { ...doc, [id]: { ...st, taken: false, count: 0, v: 2 } };
}

module.exports = { weeklyStories, visibleStories, scopeOf, STORIES, TALK_R, isOpen, storyState, markOf, trackOf, note, talk, drop, progress, TASK, COLORS, BOOKS, drawPick, askOf, visitAct };
