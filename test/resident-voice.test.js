'use strict';
// T 주민 말투 (gamecenter-notes docs/resident-voice-design-20261026.md, 사용자 「사람 주민에 말버릇」): every walker says every
// shared line in their own register, their tic once at the end and only theirs; names and particles filled; the greeting
// over the head short enough for the bubble
const test = require('node:test');
const assert = require('node:assert/strict');
const Cast = require('../public/plaza/island-cast.js');
const Errands = require('../lib/island-errands.js');
const Affinity = require('../lib/island-affinity.js');

const KEYS = ['greet1', 'greet2', 'greet3', 'ask_buy', 'ask_find', 'ask_deliver', 'hint', 'remind_buy', 'remind_find', 'remind_find_where', 'remind_deliver', 'got_buy', 'got_deliver', 'found_me', 'found_back',
  'giftLove', 'giftLike', 'giftMeh', 'giftAgain', 'giftAsk', 'giftNone', 'answerLiked', 'answerMeh', 'answerDisliked', 'answerAgain', 'errandNone', 'relRival', 'relFriend', 'letter', 'hit',
  'levelUp1', 'levelUp2', 'levelUp3', 'mem_errand', 'mem_errand_short', 'mem_answer', 'mem_gift'];
const VARS = { thing: '우산', who: '두리', from: '봄이', where: '광장', why: '꼭 할 말이 있어요.', name: '열매', when: '아까', text: '두리 찾아 주기', a: '하람', b: '이솔' };
const TAILS = Cast.VOICES.map((v) => v.tail).filter((t) => t && t.replace(/[!.…]+$/, '').length >= 2); // (one syllable -- 딱, 음, 땡 -- is an everyday word too)
// a tic as a word of its own (「깜빡」, not 「깜빡했어요」; 「꽃!」, not 「꽃을」)
const tic = (t) => new RegExp(` ${t.replace(/[!.…]+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s?!.…,])`);

test('주민 말투: 10명 × 같이 쓰는 대사 전부, 말버릇은 끝에 한 번·자기 것만, 이름·조사 채움, 말풍선 인사는 짧게', () => {
  for (let n = 0; n < 10; n += 1) {
    const mine = Cast.VOICES[n].tail;
    for (const key of KEYS) {
      for (let k = 0; k < 6; k += 1) {
        const lines = Cast.say(n, key, VARS, () => k / 6); assert.ok(lines.length, `${Cast.WALKERS[n].name} ${key}`);
        const all = lines.map((l) => Cast.fill(l, '해솔')).join(' ');
        assert.doesNotMatch(all, /\{[a-z]+(\|[^}]*)?\}/, `${n} ${key}: ${all}`); // (every slot filled)
        for (const t of TAILS) if (t !== mine) assert.ok(!tic(t).test(all), `${Cast.WALKERS[n].name} ${key}: 남의 말버릇 ${t}`);
        if (mine && all.length >= 8) { assert.equal(lines.slice(0, -1).some((l) => l.includes(` ${mine}`)), false, `${n} ${key}: 말버릇은 끝에만`); }
        if (key.startsWith('greet')) assert.ok(Cast.fill(lines[0], '여섯글자이름').length <= 34, `${n} ${key}: ${lines[0]}`);
      }
    }
  }
  // particles by the word's end: 봄이가 / 하람이 ..., 할머니의 {me|아|야}
  assert.match(Cast.say(0, 'found_me', { from: '하람' }, () => 0)[0], /^하람이 /); assert.match(Cast.say(0, 'found_me', { from: '봄이' }, () => 0)[0], /^봄이가 /);
  assert.equal(Cast.fill('{me|아|야}', '해솔'), '해솔아'); assert.equal(Cast.fill('{me|아|야}', '하나'), '하나야');
  // the five with a word at the end say it; a question keeps its mark
  assert.match(Cast.say(0, 'greet1', {}, () => 0)[0], / 꽃!$/); assert.match(Cast.withTail('오늘도 같이 걸을래요?', 0), / 꽃\?$/);
  assert.deepEqual(Cast.untail([Cast.withTail('정말 고마워요!', 3)], 3), ['정말 고마워요.']);
  // T2 (검토): the lines seen most, said by all ten -- ten different things (not one text with only the end word changed);
  // the detective says his 「~란 말이지」, 하람 her 「~랄까요」 in an errand too
  for (const key of ['ask_buy', 'ask_find', 'ask_deliver', 'got_buy', 'got_deliver', 'found_back', 'giftLike', 'levelUp1', 'levelUp2', 'levelUp3', 'letter']) {
    const said = Array.from({ length: 10 }, (_, n) => Cast.say(n, key, VARS, () => 0).map((l) => Cast.untail([l], n)[0]).join(' ').replace(/[\s.!?~…]+$/, ''));
    assert.equal(new Set(said).size, 10, `${key}: ${said.join(' / ')}`);
  }
  assert.match(Cast.say(5, 'ask_deliver', VARS, () => 0).join(' '), /란 말이지/); assert.match(Cast.say(2, 'ask_buy', VARS, () => 0).join(' '), /달까요/);
  assert.equal(Cast.say(0, 'got_deliver', { from: '봄이', thing: '우산' }, () => 0)[0], '봄이가 보낸 우산이요? 와, 고마워요!');
  // the same doing, two walkers: different words (e2e of the design: greet, gift)
  assert.notEqual(Cast.say(1, 'giftLike', VARS, () => 0)[0], Cast.say(9, 'giftLike', VARS, () => 0)[0]);
  assert.notEqual(Affinity.giftReact(0, 'herb', '약초').say, Affinity.giftReact(4, 'herb', '약초').say);
  // an errand asked by an old man, a child: their own words
  const day = '2026-10-26'; const list = Errands.errandsOf(day);
  for (const e of list) { const r = Errands.talk(list, {}, new Set(), e.from); assert.ok(r.say.length >= 2); assert.doesNotMatch(r.say.join(' '), /\{/); }
});

// B v1.10.214 (gamecenter-notes story/voices-20261029 최종본): the 27 in one list -- every one says every shared line and
// 「이야기해요」 (섬 소문 rumor_*, 이야기 나눠요 q0~q5) in their own register, their tic once at the end; their own lines
// in place of the register's (꽃님 always 「{me} 새싹」); the kid, the grandmother and the detective end their words apart
test('주민 말씨 B: 27명 × 모든 키, 이야기해요 말씨별, 자기 말이 말씨 대신, 소문·질문 어미가 서로 다름', () => {
  assert.equal(Cast.RESIDENTS.length, 27); assert.equal(Cast.WALKERS.length, 10);
  assert.deepEqual(Cast.RESIDENTS.map((c) => c.n), Array.from({ length: 27 }, (_, n) => n));
  for (const [id, n] of [['granny', 10], ['fisher', 11], ['photographer', 12], ['farmer', 13], ['kid', 14], ['painter', 15], ['stationmaster', 16], ['busker', 17], ['electrician', 18], ['builder', 19], ['librarian', 20], ['grandpa', 21], ['warden', 22]]) assert.equal(Cast.keeperN(id), n, id);
  const TALK = ['rumor_rain', 'rumor_rainbow', 'rumor_clear', 'rumor_starNight', 'rumor_starDay', 'rumor_contestLive', 'rumor_contestSoon', 'rumor_contestWeek', 'rumor_plants', 'rumor_plantsNone', 'rumor_winter', 'rumor_halloween', 'rumor_hint', 'rumor_quiet', 'q0', 'q1', 'q2', 'q3', 'q4', 'q5'];
  const vars = { ...VARS, count: 12 };
  for (const c of Cast.RESIDENTS) {
    const mine = Cast.VOICES[c.n].tail;
    for (const key of [...KEYS, ...TALK]) for (let k = 0; k < 4; k += 1) {
      const lines = Cast.say(c.n, key, vars, () => k / 4); assert.ok(lines.length, `${c.name} ${key}`);
      const all = lines.map((l) => Cast.fill(l, '해솔')).join(' ');
      assert.doesNotMatch(all, /\{[a-z]+(\|[^}]*)?\}/, `${c.name} ${key}: ${all}`);
      if (mine) { const end = new RegExp(`${tic(mine).source.split('(?=')[0]}[?!.…]*$`); assert.ok(lines.slice(0, -1).every((l) => !end.test(l)), `${c.name} ${key}: 말버릇은 끝에 한 번 -- ${all}`); }
    }
    for (const l of [...c.lines.flat(), c.morning, c.night, ...Object.values(c.moods), ...c.chat]) assert.doesNotMatch(l, /\{(?!me[}|]|you})/, `${c.name}: ${l}`);
  }
  // their own lines in place of the register's: 꽃님 calls me 「새싹」 every time, 빛나 「모델님」
  for (let k = 0; k < 6; k += 1) { assert.match(Cast.fill(Cast.say(10, 'greet2', {}, () => k / 6)[0], '해솔'), /해솔 새싹/); assert.match(Cast.fill(Cast.say(12, 'greet1', {}, () => k / 6)[0], '해솔'), /해솔 모델님/); }
  // 「이야기해요」: 가람 (꼬마), 노을 할머니, 오 탐정 -- the same rumor and question in three different endings
  const ends = (s) => s.replace(/[\s.!?~…]+$/, '').slice(-3);
  const rumors = [9, 4, 5].map((n) => Cast.rumor({ weather: 'rain' }, () => 0.9, n)); assert.equal(new Set(rumors.map(ends)).size, 3, rumors.join(' / '));
  assert.match(rumors[0], /자!$/); assert.match(rumors[1], /보렴\.$/); assert.match(rumors[2], /살펴보게\.$/);
  const asks = [9, 4, 5].map((n) => Cast.questionLine(n, 0)); assert.equal(new Set(asks.map(ends)).size, 3, asks.join(' / '));
  const day = '2026-10-31'; const k9 = Affinity.QUESTIONS.findIndex((q) => q.a[0] === Affinity.questionOf(9, day).answers[0].text);
  assert.equal(Affinity.questionOf(9, day).q, Cast.questionLine(9, k9));
  // no islander: 해요체 as before; the hint with its particle
  assert.equal(Cast.rumor({ weather: 'rain' }, () => 0.9), '비가 오면 물고기가 더 잘 문대요. 강가에 가 보세요.');
  assert.equal(Cast.rumor({ hint: { n: 4, where: '광장', errand: true } }, () => 0, 9), '노을 할머니는 요즘 광장 근처에서 자주 보인대!');
  // the keepers in their new words with their tic; the warden's words as one passes the essay stay that moment's
  assert.match(Cast.keeperLine('granny', () => 0, 2, '해솔'), /해솔 새싹.* 포근히$/); assert.match(Cast.passLine(() => 0, 0), /^통과입니다/);
});
