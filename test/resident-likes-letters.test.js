const test = require('node:test');
const assert = require('node:assert/strict');
const Cast = require('../public/plaza/island-cast');
const Affinity = require('../lib/island-affinity');
const Errands = require('../lib/island-errands');
const Roster = require('../public/plaza/island-roster');

// v1.10.220 (gamecenter-notes docs/resident-likes-letters-17-20261101.md): the 17 more islanders' likes, 8 of them their own
// letters, and the day's errands from those out walking that day
const POOL = ['fish_bass', 'insect_beetle', 'herb', 'berry', 'mushroom', 'harvest', 'candy', 'weed', 'trash', 'seed_flower_rose'];

test('새 주민 17명: 좋아하는 것 +3, 싫어하는 것 0, 그 밖 +1', () => {
  assert.equal(Affinity.LIKES.length, Cast.RESIDENTS.length);
  for (let n = 10; n < Cast.RESIDENTS.length; n += 1) {
    const { like, dislike } = Affinity.LIKES[n]; const is = (id, list) => list.some((p) => id.startsWith(p));
    const liked = POOL.find((id) => is(id, like)); const disliked = POOL.find((id) => is(id, dislike)); const other = POOL.find((id) => !is(id, like) && !is(id, dislike));
    assert.equal(Affinity.giftReact(n, liked, '나').delta, 3, `${n} ${liked}`);
    assert.equal(Affinity.giftReact(n, disliked, '나').delta, 0, `${n} ${disliked}`);
    assert.equal(Affinity.giftReact(n, other, '나').delta, 1, `${n} ${other}`);
  }
});

test('편지: 반디·바위·한결·김우성·마루·단비·한솔·새롬은 자기 편지 (같은 말투의 편지와 다름)', () => {
  for (const n of [18, 19, 20, 22, 23, 24, 25, 26]) {
    const own = Cast.RESIDENTS[n].own.letter; assert.equal(own.length, 5, String(n));
    const reg = Cast.REG[Cast.RESIDENTS[n].reg].letter || [];
    for (let k = 0; k < 5; k += 1) {
      const line = Cast.say(n, 'letter', { me: '나' }, () => k / 5 + 0.01).join(' ');
      assert.ok(own.some((t) => line.includes(t.replace('{me}', '나').replace(/[.!]$/, ''))), `${n}: ${line}`);
      assert.ok(!reg.some((t) => line.includes(String(t).replace('{me}', '나').replace(/[.!]$/, ''))), `${n} 공통 말투: ${line}`);
    }
    assert.equal(Affinity.titleOf(Affinity.titleId(n)).name, `${Cast.RESIDENTS[n].name}의 단짝`);
  }
});

test('심부름: 그날 걷는 주민끼리 (근무표가 꺼지면 열 명, 전과 같음)', () => {
  for (const day of ['2026-11-01', '2026-11-04', '2026-11-13', '2026-12-25']) {
    for (const e of Errands.errandsOf(day, (n) => Roster.walks(n, day))) {
      assert.ok(Roster.walks(e.from, day), `${day} 부탁하는 ${e.from}`); assert.ok(Roster.walks(e.to, day), `${day} 찾는 ${e.to}`);
      assert.ok(Errands.title(e).length > 3);
    }
    for (const e of Errands.errandsOf(day, (n) => n < 10)) { assert.ok(e.from < 10 && e.to < 10); }
  }
  assert.ok(['2026-11-01', '2026-11-13'].some((d) => Errands.errandsOf(d, (n) => Roster.walks(n, d)).some((e) => e.from >= 10 || e.to >= 10)), 'new islanders ask too');
});
