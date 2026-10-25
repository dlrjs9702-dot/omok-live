'use strict';

// R2 주민 상호작용 확장 (gamecenter-notes IDEAS #future-resident-interactions, backlog R2, 사용자 「호감도는 보상이랑도
// 연결」 2026-10-22): what the 호감도 levels (public/plaza/island-cast.js LEVELS) now bring, and what the islanders remember.
// Pure: the server keeps the points (point-store affinity), the paid steps (claim ids) and each account's 'resmem' doc.
// - a level reached pays once per account and islander: 아는 사이 points, 친한 사이 more and a piece of their own for my
//   house (into the 가구 창고), 단짝 a title of their own (「<name>의 단짝」, worn like the 도감's)
// - an errand asked by a 친한 islander pays a little more, a 단짝's more again (the day's three errands are the cap)
// - the last few things done together (an errand, a question answered), said back in their lines
// - a question a day each (오늘의 이야기): three answers, the one they like +2, the one they don't 0, the other +1
const Cast = require('../public/plaza/island-cast.js');

// (the amounts are the economy table's: affinity:known / affinity:close points, affinity:closeErrand / bestieErrand the
// errand's pay in % by the asker's level)
// 친한 사이's keepsake: a piece for my house that is theirs, by islander (island-cast WALKERS order)
const CLOSE_GIFT = Object.freeze(['curtain_window__pink', 'mini_lighthouse__classic', 'bookshelf__oak', 'onggi__brown', 'garden_bench__oak',
  'desk__walnut', 'counter__oak', 'picture_frame__oak', 'moon_lamp__gold', 'insect_case__oak']);
const MEMORY_KEEP = 3;
const titleId = (n) => `bestie_${n}`;
const titleOf = (id) => { const m = /^bestie_(\d+)$/.exec(String(id || '')); const c = m && Cast.WALKERS[Number(m[1])]; return c ? { id, n: Number(m[1]), name: `${c.name}의 단짝` } : null; };

// the levels passed from `before` points to `after` (each pays once)
const crossed = (before, after) => { const out = []; for (let k = Cast.levelOf(before) + 1; k <= Cast.levelOf(after); k += 1) out.push(k); return out; };

// the doc: { mem: { [n]: [{ kind, text, day }] }, asked: { [n]: day } }
function remember(doc, n, kind, text, day) {
  const mem = { ...(doc?.mem || {}) }; mem[n] = [{ kind, text: String(text).slice(0, 40), day }, ...(mem[n] || [])].slice(0, MEMORY_KEEP);
  return { ...(doc || {}), mem };
}
// a line about the last thing done together (null if nothing), {me} filled by the caller; short: for the bubble over the
// head (7회차 2 「대사가 길어지면 …으로 줄여」 -- the errand's name only in the talk, where all of it shows)
function memoryLine(doc, n, day, short = false) {
  const m = doc?.mem?.[n]?.[0]; if (!m) return null;
  const when = m.day === day ? '아까' : '지난번에';
  const said = (key, vars) => Cast.say(n, key, { when, ...vars }, () => 0).join(' '); // (T: in their own words)
  if (m.kind === 'errand') return short ? said('mem_errand_short') : said('mem_errand', { text: m.text });
  if (m.kind === 'answer') return said('mem_answer');
  if (m.kind === 'gift') return said('mem_gift', { name: short && m.text.length > 8 ? '선물' : m.text });
  return null;
}

// 오늘의 이야기: each islander's question for the day, the same for everyone (the day picks one of the pool), answers by
// id; the one they like by their own taste (the islander's number)
const QUESTIONS = Object.freeze([
  { q: '요즘 섬에서 제일 좋은 곳이 어디예요?', a: ['광장 분수 앞', '바다가 보이는 언덕', '조용한 숲길'] },
  { q: '아침형이에요, 저녁형이에요?', a: ['해 뜨면 바로 나와요', '노을 질 때가 좋아요', '둘 다 별로… 낮잠이 최고'] },
  { q: '비 오는 날엔 뭐 해요?', a: ['낚시하러 가요', '창밖 구경해요', '집에서 가구를 옮겨요'] },
  { q: '섬에 하나 더 생긴다면 뭐가 좋을까요?', a: ['큰 도서관', '바닷가 놀이터', '밤에 여는 시장'] },
  { q: '제일 좋아하는 계절은요?', a: ['꽃 피는 봄', '바다 수영하는 여름', '단풍 드는 가을'] },
  { q: '선물을 받는다면 뭐가 좋아요?', a: ['직접 잡은 물고기', '예쁜 꽃 한 송이', '맛있는 열매'] },
]);
const dayNumber = (day) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000);
function questionOf(n, day) {
  const q = QUESTIONS[(dayNumber(day) + n * 7) % QUESTIONS.length];
  const liked = (n * 5 + dayNumber(day)) % 3; const disliked = (liked + 1 + (n % 2)) % 3;
  return { q: q.q, answers: q.a.map((text, i) => ({ id: i, text })), liked, disliked };
}
// an answer: its 호감도 and their reply -> null when the id is not one of today's
function answer(n, day, id) {
  const q = questionOf(n, day); if (!Number.isInteger(id) || !q.answers[id]) return null;
  const delta = id === q.liked ? 2 : id === q.disliked ? 0 : 1;
  const say = Cast.say(n, delta === 2 ? 'answerLiked' : delta === 0 ? 'answerDisliked' : 'answerMeh').join(' '); // (T: in their own words)
  return { delta, say, text: q.answers[id].text };
}

// R3 ⑥ 선물: one thing from my bag a day each -- what they like +3, what they don't 0 (said kindly), anything else +1. By
// the item's id start (fish_, insect_, the island's finds). Tools, pets and goods are not given.
const LIKES = Object.freeze([
  { like: ['herb', 'seed_flower'], dislike: ['fish_'] }, { like: ['fish_'], dislike: ['insect_'] }, { like: ['insect_'], dislike: ['mushroom'] },
  { like: ['berry', 'herb'], dislike: ['insect_'] }, { like: ['herb', 'mushroom'], dislike: ['trash'] }, { like: ['mushroom', 'insect_'], dislike: ['berry'] },
  { like: ['berry', 'harvest'], dislike: ['fish_'] }, { like: ['candy', 'berry'], dislike: ['mushroom'] }, { like: ['insect_firefly', 'candy'], dislike: ['trash'] },
  { like: ['insect_', 'mushroom'], dislike: ['herb'] }]);
const GIFTABLE = (itemId) => /^(fish_|insect_)/.test(itemId) || ['weed', 'trash', 'herb', 'berry', 'mushroom', 'harvest', 'candy'].includes(itemId) || itemId.startsWith('seed_flower');
function giftReact(n, itemId, name) {
  const t = LIKES[n]; if (!t || !GIFTABLE(itemId)) return null; const has = (list) => list.some((p) => itemId.startsWith(p));
  const said = (key) => Cast.say(n, key, { name }).join(' '); // (T: in their own words)
  if (has(t.like)) return { delta: 3, say: said('giftLove') };
  if (has(t.dislike)) return { delta: 0, say: said('giftMeh') };
  return { delta: 1, say: said('giftLike') };
}
// R3 ⑥ 편지: an islander I am close to (친한 사이 and on) writes now and then -- one a day at most, the closest of the day's
// (T: in their own words -- the day picks one of their register's letters)
const letterOf = (n, day) => { const k = dayNumber(day) + n; return Cast.say(n, 'letter', {}, () => (k % 5) / 5 + 0.01).join(' '); };

module.exports = { CLOSE_GIFT, titleId, titleOf, crossed, remember, memoryLine, QUESTIONS, questionOf, answer, LIKES, GIFTABLE, giftReact, letterOf };

if (require.main === module) {
  const assert = require('node:assert/strict');
  assert.deepEqual(crossed(4, 5), [1]); assert.deepEqual(crossed(0, 30), [1, 2, 3]); assert.deepEqual(crossed(15, 16), []);
  assert.equal(titleOf('bestie_2').name, `${Cast.WALKERS[2].name}의 단짝`); assert.equal(titleOf('bestie_99'), null);
  let doc = {}; for (let i = 0; i < 5; i += 1) doc = remember(doc, 3, 'errand', `일${i}`, '2026-10-23');
  assert.equal(doc.mem[3].length, 3); assert.match(memoryLine(doc, 3, '2026-10-23'), /아까 「일4」/); assert.equal(memoryLine(doc, 3, '2026-10-23', true), '아까 도와줘서 고마웠어요, {me}님 붕붕'); // (두리's tail)
  const q = questionOf(1, '2026-10-23'); assert.equal(q.answers.length, 3); assert.notEqual(q.liked, q.disliked);
  assert.equal(answer(1, '2026-10-23', q.liked).delta, 2); assert.equal(answer(1, '2026-10-23', q.disliked).delta, 0); assert.equal(answer(1, '2026-10-23', 7), null);
  const F = require('../public/plaza/island-furniture.js'); assert.equal(CLOSE_GIFT.length, Cast.WALKERS.length); for (const id of CLOSE_GIFT) assert.ok(F.good(id), id);
  console.log('island-affinity ok');
}
