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
const TAILS = Cast.VOICES.map((v) => v.tail).filter(Boolean);

test('주민 말투: 10명 × 같이 쓰는 대사 전부, 말버릇은 끝에 한 번·자기 것만, 이름·조사 채움, 말풍선 인사는 짧게', () => {
  for (let n = 0; n < 10; n += 1) {
    const mine = Cast.VOICES[n].tail;
    for (const key of KEYS) {
      for (let k = 0; k < 6; k += 1) {
        const lines = Cast.say(n, key, VARS, () => k / 6); assert.ok(lines.length, `${Cast.WALKERS[n].name} ${key}`);
        const all = lines.map((l) => Cast.fill(l, '해솔')).join(' ');
        assert.doesNotMatch(all, /\{[a-z]+(\|[^}]*)?\}/, `${n} ${key}: ${all}`); // (every slot filled)
        for (const t of TAILS) if (t !== mine) assert.ok(!all.includes(` ${t.replace(/[!.…]+$/, '')}`), `${Cast.WALKERS[n].name} ${key}: 남의 말버릇 ${t}`);
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
